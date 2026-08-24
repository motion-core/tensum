# Spring by Motion Core

Spring is a GSAP plugin backed by an analytical spring solver. GSAP owns the timeline, scheduling, context, and property writes. Spring calculates position and velocity from absolute time.

There is one published package:

```text
@motion-core/spring
```

The public spring configuration has no required duration. Duration comes from the physical state and settling tolerances.

## Install

```bash
pnpm add @motion-core/spring gsap
```

Both packages are required. GSAP is a peer dependency so an application and the plugin use the same GSAP instance.

## Register the plugin

```ts
import { gsap } from 'gsap';
import {
  SpringPlugin,
  springPresets,
} from '@motion-core/spring';

gsap.registerPlugin(SpringPlugin);

gsap.to(element, {
  motionSpring: {
    x: 600,
    rotation: '30deg',
    parameters: springPresets.snappy(),
  },
});
```

`registerSpringPlugin(gsap)` is available when an application prefers an explicit registration helper. The previous `MotionCoreSpringPlugin` and `registerMotionCoreSpringPlugin` names remain as compatibility aliases.

## Use springs in a GSAP timeline

`motionSpring` is a GSAP special property. It participates in normal timeline positioning, pause, seek, reverse, `timeScale`, context cleanup, and property-level ownership.

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

When two Motion Core springs overlap on the same target and property, the newer spring inherits the analytical position and velocity of the active track. Only the current owner writes that property. Seeking directly across the handoff produces the same state as playing through it frame by frame.

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

Starting another `springTo()` or `motionSpring` animation on the same target and property performs an automatic velocity-preserving handoff.

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
packages/spring   one published GSAP plugin package
apps/lab          Svelte development and verification surface
```

Inside the package, the analytical solver stays separate from the GSAP adapter so sampling remains deterministic. This is an implementation boundary, not another published library.

## Development

```bash
pnpm install
pnpm dev
pnpm test
pnpm check
pnpm lint
pnpm build
pnpm benchmark
```

The package is ESM-only, publishes compiled JavaScript with declarations and source maps, and requires Node.js 18 or newer for development and server-side use. Version `0.x` may contain breaking API changes.
