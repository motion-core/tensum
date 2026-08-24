# `@motion-core/spring`

Analytical spring physics for GSAP timelines and direct controllers.

Version `0.1.0` is currently unreleased. See [CHANGELOG.md](CHANGELOG.md) for
the release contents.

## Install

The registry command below applies after `0.1.0` is published. Until then, use
the workspace package or a tarball created by `pnpm release:check`.

```bash
pnpm add @motion-core/spring gsap
```

GSAP is a peer dependency. The application and the plugin therefore use the
same GSAP instance.

The package is ESM-only:

```ts
import { SpringPlugin, springTo } from '@motion-core/spring';
```

CommonJS `require()` is not supported. A CommonJS module can use dynamic
`import('@motion-core/spring')` when migration to ESM is not yet practical.

## Register the timeline plugin

```ts
import { gsap } from 'gsap';
import { SpringPlugin } from '@motion-core/spring';

gsap.registerPlugin(SpringPlugin);
```

`registerSpringPlugin(gsap)` is an equivalent explicit helper. The older
`MotionCoreSpringPlugin` and `registerMotionCoreSpringPlugin` exports remain as
compatibility aliases.

GSAP owns the clock, timeline lifecycle, context, and property writes. The
plugin calculates position and velocity from absolute elapsed time. Seeking or
sampling at a different frame rate does not change the trajectory.

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
destinations. It is a property map, so a tween can snapshot different starting
values for `x`, `rotation`, or custom numeric properties. If `from` is omitted,
the construction-time value and any currently active Motion Core track are used.

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

The effect supports array targets, stagger, repeats, yoyo playback, and nested
timelines. It owns `duration`, `ease`, and `motionSpring`. The helper discards
those keys if they are present in `tween`.

Use `createMotionSpringTween()` when code needs a preflighted tween without the
extended timeline method:

```ts
import { createMotionSpringTween } from '@motion-core/spring';

const tween = createMotionSpringTween(element, {
  x: 320,
  from: { x: 0 },
  parameters: { mass: 1, stiffness: 180, damping: 24 },
  tween: { paused: true },
});

timeline.add(tween, 0.5);
```

## Legacy special-property syntax

The original `gsap.to({ motionSpring: ... })` syntax remains supported:

```ts
gsap.to(element, {
  motionSpring: {
    x: 600,
    rotation: '30deg',
    parameters: { mass: 1, stiffness: 180, damping: 24 },
  },
});
```

Use it for a direct tween or for timeline children placed at explicit positions.
GSAP initializes special properties lazily, after a timeline has already placed
sequential children using its current duration. The plugin can update its own
duration at that point, but it cannot move a child that GSAP already positioned.

For a sequential timeline, the basic migration is:

```ts
// Before: GSAP positions the next child before this duration is known.
timeline.to(element, { motionSpring: springVars });

// After: the effect returns a tween with its final duration.
timeline.motionSpring(element, springVars);
```

Move ordinary tween settings such as `stagger` or `repeat` into
`springVars.tween`. Add `from` when the starting value comes from an earlier
child.

The special-property form still provides runtime position and velocity handoff.
Overlapping tracks on the same target and property share a registry, and the
newer track becomes the only writer.

Pause, seek, reverse, `timeScale`, property-level kill, and GSAP context cleanup
retain their normal GSAP behavior. Seeking directly across a handoff produces
the same state as playing through it.

## Controller API

Use `springTo()` when code needs direct playback controls rather than a GSAP
timeline child:

```ts
import { springTo } from '@motion-core/spring';

const animation = springTo(element, {
  x: 600,
  rotation: '30deg',
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
  targets: { opacity: 1, '--reveal': '100%' },
  spring: { mass: 1, stiffness: 180, damping: 24 },
});
```

Numeric strings may contain one unit, such as `24px`, `30deg`, or `100%`. A unit
mismatch throws before the animation starts. Use `adapters` when a property
needs custom read and write behavior.

Starting another `springTo()` animation or a lazily initialized `motionSpring`
special-property tween on the same target and property performs an automatic
velocity-preserving handoff. Preflighted effects use their construction snapshot
instead.

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
import { springParameters, springPresets } from '@motion-core/spring';

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

- `onLogicalComplete` fires at the perceptual duration;
- `onSettle` fires at physical settlement;
- `onUnsettled` fires when `maxDuration` is reached without settlement;
- `springTo()` also accepts `onUpdate` and `onComplete`.

An undamped moving spring cannot settle. Choose an `unsettled` policy when that
case is possible:

- `stop` freezes at `maxDuration` and is the default;
- `snap` writes the target at `maxDuration`;
- `continue` keeps an infinite GSAP clock running;
- `error` rejects the animation before it starts.

## Other exports

The root entry point also exports the analytical solver, parameter converters,
velocity helpers, spring values, keyframes, inertia, additive composition, and
vector springs.

CSS `linear()` generation and coupled systems use explicit subpaths:

```ts
import { springToCSSLinear } from '@motion-core/spring/css';
import { createCoupledSpringSystem } from '@motion-core/spring/coupled';
```

## Compatibility

- Runtime: Node.js 18 or newer and browser environments supported by the
  installed GSAP version.
- Peer dependency: GSAP `^3.15.0`.
- Modules: ESM only; CommonJS `require()` is intentionally absent from the
  export map.
- TypeScript: use `moduleResolution: "node16"`, `"nodenext"`, or `"bundler"`.
  Legacy `moduleResolution: "node"` cannot resolve the `css` and `coupled`
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
separate temporary consumers, then checks Node ESM, TypeScript, plugin
registration, `springTo()`, and `timeline.motionSpring()`. This command may read
the npm registry, so it is intentionally separate from `release:check`.

## License

MIT, copyright 2026 Motion Core. See [LICENSE](LICENSE).
