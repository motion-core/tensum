# `tensum`

Analytical spring physics for GSAP timelines and direct controllers.

## Install

```bash
pnpm add tensum gsap
```

GSAP is a peer dependency. The application and the plugin therefore use the
same GSAP instance.

The package is ESM-only:

```ts
import { registerSpringPlugin, springTo } from "tensum";
```

CommonJS `require()` is not supported. A CommonJS module can use dynamic
`import('tensum')` when migration to ESM is not yet practical.

## Register the timeline integration

```ts
import { gsap } from "gsap";
import { registerSpringPlugin } from "tensum";

registerSpringPlugin(gsap);
```

GSAP owns the clock, timeline lifecycle, and context. During each driver render,
Tensum calculates position and velocity from absolute elapsed time and writes
the sampled values through GSAP property setters. Seeking or sampling at a
different frame rate does not change the analytical trajectory.

## Compose derived-duration timelines

Use `timeline.motionSpring()` when spring duration affects the position or
duration of other timeline children. It is a registered GSAP effect with
`extendTimeline: true`. The effect resolves every spring track before returning
its tween, so GSAP receives the final duration before it lays out the timeline.

```ts
const timeline = gsap.timeline();

timeline
  .motionSpring(element, {
    x: 320,
    from: { x: 0 },
    parameters: { mass: 1, stiffness: 180, damping: 24 },
  })
  .motionSpring(element, {
    x: 80,
    from: { x: 320 },
    parameters: { mass: 1, stiffness: 240, damping: 26 },
  });
```

The second tween starts when the first tween's derived duration ends. No GSAP
`duration` is required.

### Starting state and velocity

Preflight reads each target when the effect is created. Add `from` when an
earlier timeline child will change that target before the spring starts:

```ts
timeline.motionSpring(element, {
  x: 80,
  from: { x: 320 },
  velocity: { x: -240 },
  parameters: { mass: 1, stiffness: 240, damping: 26 },
});
```

`from` accepts the same numeric values and single-unit strings as spring
destinations. It is one property map applied to every resolved target, so a
tween can snapshot different starting values for `x`, `rotation`, or custom
numeric properties. If `from` is omitted, preflight reads each target at effect
construction time and inherits any currently active Tensum track.

This distinction matters for timelines built before playback. A state created by
an earlier child does not exist yet, so the effect cannot read it automatically.
Pass both `from` and `velocity` when that future state must be exact.

### GSAP tween options

Put GSAP driver options in `tween`:

```ts
const entrance = gsap.timeline().motionSpring(cards, {
  y: 0,
  from: { y: -24 },
  parameters: { mass: 1, stiffness: 180, damping: 24 },
  tween: {
    stagger: 0.06,
    repeat: 1,
    yoyo: true,
  },
});

masterTimeline.add(entrance, 0.4);
```

The effect supports array targets, stagger, and nested timelines. Finite springs
also support native repeat, repeat delay, and yoyo playback. It owns `duration`
and `ease`; the helper discards those keys if they are present in `tween`.

An unsettled spring using `continue` has different timing. The effect sets a
one-second GSAP driver with `repeat: -1` and samples the spring from `totalTime`,
so the analytical trajectory keeps moving forward across driver cycles. Do not
use `repeat` or `yoyo` to choreograph a `continue` spring. Kill its property or
its tween to end the infinite driver; covering it with a newer track only changes
which track writes the property.

Use `createMotionSpringTween()` when code needs a preflighted tween without the
extended timeline method:

```ts
import { createMotionSpringTween } from "tensum";

const tween = createMotionSpringTween(element, {
  x: 320,
  from: { x: 0 },
  parameters: { mass: 1, stiffness: 180, damping: 24 },
  tween: { paused: true },
});

timeline.add(tween, 0.5);
```

## GSAP lifecycle

Overlapping effects on the same target and property share a registry, and the
newer track becomes the only writer.

Pause, seek, reverse, and `timeScale` use GSAP's clock while Spring samples the
corresponding absolute or cycle-local time. Seeking directly across a handoff
produces the same state as playing through it.

### Kill, invalidate, repeat, and context

Property-level kill removes only the matching spring track. Killing the final
track returns control of that PropTween to GSAP. If a killed track was the
reason an unsettled `continue` tween was infinite, the driver recomputes its
duration from the remaining tracks and restores the repeat count supplied by
the application.

Calling `invalidate()` reuses the snapshot and duration captured at
construction. Create a new effect tween when `from`, destinations, or spring
parameters must be preflighted again.

Finite repeats use cycle-local time for handoff. During a yoyo cycle, the
inherited velocity changes sign with the playback direction. Kill, interrupt,
and context revert release active ownership; a killed newer track restores the
previous live track when one still exists.

### Terminal handoff and external writes

A normally completed owner remains as a terminal handoff baseline. Older tracks
that it covered are discarded, so they cannot reclaim the property during a
later forward tick. A settled spring stores the target with zero velocity.
`snap` does the same. An unsettled `stop` spring stores its analytical position
and velocity at `maxDuration`, even though its visible value stops changing.
The next Tensum track can therefore continue from that capped state.

Before an implicit handoff inherits a terminal baseline, Tensum compares it
with the value currently on the target. If application code wrote a different
value after completion, Tensum discards the terminal history and starts
from the external value with the configured velocity, or zero by default. This
reconciliation applies when `from` is omitted. An explicit `from` is the effect's
requested construction snapshot.

## Controller API

Use `springTo()` when code needs direct playback controls rather than a GSAP
timeline child:

```ts
import { springTo } from "tensum";

const animation = springTo(element, {
  x: 600,
  rotation: "30deg",
  velocity: { x: 1250 },
  spring: {
    mass: 1,
    stiffness: 180,
    damping: 24,
    settle: { position: 0.1, velocity: 0.1 },
  },
  properties: {
    rotation: { damping: 30, velocity: 90 },
  },
});

animation.pause();
animation.seek(0.2);
animation.resume();
animation.playbackReverse();
animation.kill();
```

The built-in transform properties are `x`, `y`, `scale`, and `rotation`. Put
other numeric GSAP properties in `targets`:

```ts
const opacitySpring = springTo(element, {
  targets: { opacity: 1, "--reveal": "100%" },
  spring: { mass: 1, stiffness: 180, damping: 24 },
});
```

Numeric strings may contain one unit, such as `24px`, `30deg`, or `100%`. A unit
mismatch throws before the animation starts. Use `adapters` when a property
needs custom read and write behavior.

Starting another `springTo()` animation or constructing a `motionSpring` effect
on the same target and property performs an automatic velocity-preserving
handoff from the state available at construction time.

## Parameters

Pass physical parameters directly:

```ts
const parameters = {
  mass: 1,
  stiffness: 180,
  damping: 24,
};
```

Or derive them from controls that are easier to tune:

```ts
import { springParameters, springPresets } from "tensum";

const tuned = springParameters.fromPerceptualDuration({
  duration: 0.5,
  bounce: 0.15,
});

const snappy = springPresets.snappy();
```

Time values are seconds. Velocity is measured in property units per second.
The solver itself is unit-agnostic.

## Completion and settlement

A damped spring approaches equilibrium without reaching it mathematically. The
runtime considers it settled when both the remaining distance and velocity stay
inside their configured tolerances.

The callbacks describe separate boundaries:

- `onLogicalComplete` fires at the requested perceptual duration or at an
  earlier finite driver boundary. An unsettled `continue` track is not clamped;
- `onSettle` fires at physical settlement;
- `onUnsettled` fires when `maxDuration` is reached without settlement;
- `springTo()` also accepts `onUpdate` and `onComplete`.

The three effect lifecycle callbacks are target-scoped. A tween with an array
of targets invokes each callback once per target. Its `SpringToSnapshot`
contains the states for that target but does not include a target or index. Use
one tween per target when the callback must identify its source.

An undamped moving spring cannot settle. Choose an `unsettled` policy when that
case is possible:

- `stop` is the default. It freezes at the analytical state sampled at
  `maxDuration` and retains that state's velocity for a later handoff;
- `snap` writes the target with zero velocity at `maxDuration`;
- `continue` uses an infinite GSAP driver and keeps sampling analytical
  `totalTime` until the track is killed;
- `error` rejects the unsettled track during initialization.

`onSettle` does not run for `stop`, `snap`, or `continue` when the settling
solver reports an unsettled result. `onUnsettled` runs once per forward crossing
of `maxDuration`; a finite repeat or yoyo may create another crossing.

## Other exports

The root entry point also exports the analytical solver, parameter converters,
velocity helpers, spring values, keyframes, inertia, additive composition, and
vector springs.

CSS `linear()` generation and coupled systems use explicit subpaths:

```ts
import { springToCSSLinear } from "tensum/css";
import { createCoupledSpringSystem } from "tensum/coupled";
```

## Compatibility

- Runtime: Node.js 20.19.x or Node.js 22.12 and newer, plus browser
  environments supported by the
  installed GSAP version.
- Peer dependency: GSAP `^3.15.0`.
- Modules: ESM only; CommonJS `require()` is intentionally absent from the
  export map.
- TypeScript: use `moduleResolution: "node16"`, `"nodenext"`, or `"bundler"`.
  Classic `moduleResolution: "node"` cannot resolve the `css` and `coupled`
  subpaths.

Compiled JavaScript, declarations, source maps, declaration maps, and the
corresponding TypeScript source are included in the package.

## Verify a release locally

From the repository root:

```bash
pnpm release:check
```

This builds and tests the workspaces, runs lint and type checks, validates the
manifest, then installs the packed tarball in a temporary consumer. The
consumer checks all three entry points at runtime and under TypeScript Node16,
NodeNext, and Bundler resolution. It also verifies the ESM-only contract. The
command does not publish or tag anything.

Run the optional GSAP compatibility matrix before changing the peer range or
cutting a release:

```bash
pnpm release:compat
```

It installs the exact peer lower bound and the current npm `latest` tag in
separate temporary consumers, then checks Node ESM, TypeScript, effect
registration, `springTo()`, and `timeline.motionSpring()`. This command may read
the npm registry, so it is intentionally separate from `release:check`.

## License

MIT, copyright 2026 Motion Core. See [LICENSE](LICENSE).
