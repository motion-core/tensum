# Spring by Motion Core

Spring is a GSAP plugin backed by an analytical spring solver. GSAP owns the timeline, scheduling, context, and property writes. Spring calculates position and velocity from absolute time.

The repository contains one package prepared for public distribution:

```text
@motion-core/spring
```

Version `0.1.0` is currently unreleased. The package manifest, tarball checks, and
consumer contract are kept in the repository so a release can be rehearsed
without publishing anything.

The public spring configuration has no required duration. Duration comes from the physical state and settling tolerances.

## Install

The registry command below applies after `0.1.0` is published. Until then, use
the workspace package or a tarball created by the local release check.

```bash
pnpm add @motion-core/spring gsap
```

Both packages are required. GSAP is a peer dependency so an application and the plugin use the same GSAP instance.

## Register the plugin

```ts
import { gsap } from 'gsap';
import { SpringPlugin, springPresets } from '@motion-core/spring';

gsap.registerPlugin(SpringPlugin);
```

`registerSpringPlugin(gsap)` is available when an application prefers an explicit registration helper. The previous `MotionCoreSpringPlugin` and `registerMotionCoreSpringPlugin` names remain as compatibility aliases.

## Compose springs in a GSAP timeline

Use the registered `timeline.motionSpring()` effect when a spring's derived
duration affects timeline layout. The effect calculates the duration before
GSAP inserts the tween, so sequential children, staggered targets, and nested
timelines have their final timing immediately.

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

`from` snapshots the state from which preflight should calculate. Omit it when
the target already has the right value while the effect is being created. Set
it when an earlier timeline child will change that value before this spring
starts. Use the existing `velocity` option when the future state also has a
known velocity.

Pass ordinary GSAP options through `tween`. The effect owns `duration`, `ease`,
and `motionSpring`; options such as `stagger`, `repeat`, and `yoyo` remain
available.

```ts
const entrance = gsap.timeline().motionSpring(cards, {
  y: 0,
  from: { y: -24 },
  parameters: springPresets.snappy(),
  tween: { stagger: 0.06, repeat: 1, yoyo: true },
});

masterTimeline.add(entrance, 0.4);
```

`createMotionSpringTween(targets, vars)` exposes the same preflight step when
code needs the tween itself rather than the extended timeline method.

### Legacy special-property syntax

The original special property remains available for direct tweens and timeline
children whose positions do not depend on its duration:

```ts
gsap.to(element, {
  motionSpring: {
    x: 600,
    rotation: '30deg',
    parameters: springPresets.snappy(),
  },
});
```

GSAP initializes special properties lazily. The spring therefore cannot replace
the placeholder duration before a timeline positions the next sequential child.
Use `timeline.motionSpring()` when duration affects layout. Existing timelines
with numeric or otherwise explicit child positions may keep the special-property
syntax.

## Use the controller API

`springTo()` is the direct API for cases that need a controller rather than a timeline child.

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
```

Built-in transform properties are `x`, `y`, `scale`, and `rotation`. Use `targets` for other numeric GSAP properties or `adapters` for custom read/write behavior. Numeric strings may contain one unit, such as `24px` or `30deg`. A unit mismatch throws before animation starts.

Starting another `springTo()` animation, or a lazily initialized `motionSpring`
special-property tween, on the same target and property performs an automatic
velocity-preserving handoff. A preflighted effect instead uses its construction
snapshot; provide `from` and `velocity` for a state that will only exist later in
the timeline.

## Physical and perceptual parameters

Supply physical parameters directly:

```ts
const parameters = {
  mass: 1,
  stiffness: 180,
  damping: 24,
};
```

Or derive them from product-facing controls:

```ts
import { springParameters, springPresets } from '@motion-core/spring';

const tuned = springParameters.fromPerceptualDuration({
  duration: 0.5,
  bounce: 0.15,
});

const snappy = springPresets.snappy();
```

All time values are seconds. Velocity is property units per second. The solver is unit-agnostic; `x` may use pixels while `rotation` uses degrees.

## Settlement

A damped spring approaches equilibrium asymptotically. The plugin treats a spring as physically settled when both conditions remain true for its future tail:

```text
abs(position - target) <= positionEpsilon
abs(velocity) <= velocityEpsilon
```

Absolute tolerances allow a longer movement to take longer to settle even when its normalized response is the same.

An undamped moving spring never reaches physical rest. Choose an `unsettled` policy explicitly when this is possible:

- `stop` freezes at `maxDuration` and is the default;
- `snap` writes the target at `maxDuration`;
- `continue` keeps an infinite GSAP clock running;
- `error` rejects the animation.

## Supporting exports

The previous solver and runtime packages have been folded into `@motion-core/spring`. Existing capabilities remain available from the same package entry point, including `createSpring`, parameter converters, velocity helpers, spring values, keyframes, inertia, and additive composition. They support the plugin and migration of existing code; they are no longer separate products or workspace packages.

Advanced CSS and coupled-system utilities remain package subpaths:

```ts
import { springToCSSLinear } from '@motion-core/spring/css';
import { createCoupledSpringSystem } from '@motion-core/spring/coupled';
```

## Repository structure

```text
packages/spring   one public GSAP plugin package
apps/site         Svelte product site and interactive playground
```

Inside the package, the analytical solver stays separate from the GSAP adapter so sampling remains deterministic. This is an implementation boundary, not another public library.

## Development

```bash
pnpm install
pnpm dev
pnpm test
pnpm check
pnpm lint
pnpm build
pnpm benchmark
pnpm release:check
```

The package runtime supports Node.js 18 or newer. Working in this repository
requires Node.js 20.19.x, or Node.js 22.12 and newer, because the current build
and test tools no longer run on Node 18. `pnpm release:check` builds every
workspace, runs all checks, validates the package manifest, packs a tarball,
and installs that tarball in a temporary consumer project. It does not publish
or tag a release.

The package is ESM-only. TypeScript consumers should use `node16`, `nodenext`,
or `bundler` module resolution. CommonJS code can load it with dynamic
`import()`, but `require()` is intentionally unsupported. Version `0.x` may
contain breaking API changes.

See the [package README](packages/spring/README.md) for the full public API and
the [changelog](packages/spring/CHANGELOG.md) for release status.

## License

MIT, copyright 2026 Motion Core. See [LICENSE](LICENSE).
