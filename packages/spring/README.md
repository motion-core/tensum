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
import { SpringPlugin, springPresets } from '@motion-core/spring';

gsap.registerPlugin(SpringPlugin);

gsap.to(element, {
  motionSpring: {
    x: 600,
    rotation: '30deg',
    parameters: springPresets.snappy(),
  },
});
```

`registerSpringPlugin(gsap)` is an equivalent explicit helper. The older
`MotionCoreSpringPlugin` and `registerMotionCoreSpringPlugin` exports remain as
compatibility aliases.

GSAP owns the clock, timeline lifecycle, context, and property writes. The
plugin calculates position and velocity from absolute elapsed time. Seeking or
sampling at a different frame rate does not change the trajectory.

Spring duration comes from physical parameters and settling tolerances. Do not
set a GSAP `duration` for `motionSpring`; the plugin updates the tween duration
after it resolves every spring track.

## Timeline handoff

Overlapping `motionSpring` tweens on the same target and property share a track
registry. The newer tween inherits the current analytical position and velocity
and becomes the only writer.

```ts
const timeline = gsap.timeline();

timeline
  .to(element, {
    motionSpring: {
      x: 320,
      parameters: { mass: 1, stiffness: 180, damping: 24 },
    },
  })
  .to(
    element,
    {
      motionSpring: {
        x: 80,
        parameters: { mass: 1, stiffness: 240, damping: 26 },
      },
    },
    '<0.2',
  );
```

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

Starting another `springTo()` or `motionSpring` animation on the same target and
property performs an automatic velocity-preserving handoff.

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

## License

MIT, copyright 2026 Motion Core. See [LICENSE](LICENSE).
