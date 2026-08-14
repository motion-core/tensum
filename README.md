# Motion Core Spring

Motion Core Spring is a small set of TypeScript packages for analytical spring motion. The solver evaluates position and velocity from absolute time, while optional packages add reactive values, inertia, keyframes, GSAP rendering, CSS `linear()` export, and coupled systems.

The central rule is:

> Duration is a result of the physical state and settling tolerances, not an input to the solver.

The packages are ESM-only and require Node.js 18 or newer for development and server-side use. Version `0.x` may still contain breaking API changes.

## Packages

| Package | Purpose |
| --- | --- |
| `@motion-core/spring` | DOM-free analytical scalar and vector springs, parameter converters, and timing |
| `@motion-core/spring-runtime` | Reactive values, velocity handoff, keyframes, inertia, and bounds |
| `@motion-core/gsap-spring` | GSAP clock adapter and `motionSpring` special-property plugin |
| `@motion-core/spring-lab` | Svelte 5 development lab |

Advanced DOM-free features use explicit subpaths:

- `@motion-core/spring/css` exports adaptive CSS `linear()` sampling.
- `@motion-core/spring/coupled` exports an RK4 coupled-spring system.

## Install

Install only the layers you need:

```bash
pnpm add @motion-core/spring
pnpm add @motion-core/spring-runtime
pnpm add @motion-core/gsap-spring gsap
```

## Create a spring

```ts
import { createSpring } from '@motion-core/spring';

const spring = createSpring({
  from: 0,
  to: 600,
  velocity: 1250,
  mass: 1,
  stiffness: 180,
  damping: 24,
  settle: {
    position: 0.1,
    velocity: 0.1,
  },
});

spring.positionAt(0.25);
spring.velocityAt(0.25);
spring.stateAt(0.25);
spring.getSettlingResult();
```

All time values are seconds. Velocity is position units per second. The solver is unit-agnostic, so a pixel animation uses pixels and pixels per second, while a rotation can use degrees and degrees per second.

The spring exposes the damping regime, damping ratio, angular frequency, initial state, physical parameters, settling options, and two timing phases:

- `timing.perceptualDuration` is the optional logical completion boundary.
- `timing.settlingDuration` is the conservative physical-rest boundary.
- `timing.settled` tells you whether the spring reached its tolerances within `maxDuration`.

An undamped moving spring never settles. The API reports that state explicitly instead of inventing a finite physical duration.

## Choose spring parameters

Use physical parameters directly, derive them from Apple-style response concepts, or use the isolated Motion compatibility profile:

```ts
import {
  motionSpringParameters,
  springParameters,
  springPresets,
} from '@motion-core/spring';

const physical = springParameters.fromPhysics({
  mass: 1,
  stiffness: 180,
  damping: 24,
});

const response = springParameters.fromResponse({
  response: 0.5,
  dampingRatio: 0.82,
});

const snappy = springPresets.snappy({ duration: 0.45 });

const motionCompatible = motionSpringParameters.fromDuration({
  duration: 0.6,
  bounce: 0.25,
});
```

The canonical converters preserve transparent physical semantics. `motionSpringParameters` is a separately versioned compatibility layer, currently audited against Motion `13.1.0` at commit `adaf7a4e5368d704ea350669f6ac674fb26ff270`.

## Retarget without losing momentum

`retarget()` samples both position and analytical velocity at the interruption time:

```ts
const next = spring.retarget(100, 0.25);
```

For a frame-driven value, use the runtime package. A driver owns scheduling only; the spring still owns the trajectory.

```ts
import { createSpringValue } from '@motion-core/spring-runtime';
import { springPresets } from '@motion-core/spring';

const driver = {
  now: () => performance.now() / 1000,
  schedule(callback: (time: number) => void) {
    const id = requestAnimationFrame((time) => callback(time / 1000));
    return () => cancelAnimationFrame(id);
  },
};

const value = createSpringValue(
  0,
  { mass: 1, stiffness: 180, damping: 24 },
  driver,
);

const unsubscribe = value.on('change', ({ value }) => {
  element.style.transform = `translateX(${value}px)`;
});

value.setTarget(600);
value.setTarget(100, {
  parameters: springPresets.snappy(),
  blendDuration: 0.08,
});

unsubscribe();
value.destroy();
```

`SpringValue` also emits `logicalComplete`, `settle`, and `unsettled`. Parameter blending uses a deterministic position-and-velocity blend, so a mid-flight tuning change has no state discontinuity.

Replacement and additive semantics are separate APIs. Use `createSpringValue()` when a new target replaces the active target. Use `createAdditiveSpringValue()` when independent effects should overlap and sum:

```ts
import { createAdditiveSpringValue } from '@motion-core/spring-runtime';

const offset = createAdditiveSpringValue(0, springPresets.smooth(), driver);
offset.animateBy(40);
offset.animateBy(-12, { parameters: springPresets.bouncy() });
```

Each contribution owns its analytical position and velocity. Settled contributions are folded into the base value without a discontinuity. `cancel(id)` removes one effect while preserving the current position; `stop()` freezes the complete composition.

## Hand off gesture velocity

```ts
import {
  normalizedVelocity,
  physicalVelocity,
  velocityFromSamples,
} from '@motion-core/spring-runtime';

const pixelsPerSecond = velocityFromSamples(
  { value: 120, time: 1.0 },
  { value: 180, time: 1.05 },
);
const progressPerSecond = normalizedVelocity(pixelsPerSecond, 0, 600);
const degreesPerSecond = physicalVelocity(progressPerSecond, 0, 360);
```

Samples use seconds. The helper rejects non-finite data and non-monotonic timestamps.

## Animate with GSAP

`springTo()` creates one analytical spring per numeric property. GSAP provides the clock, lifecycle, and property writes; it does not calculate the spring curve.

```ts
import { springTo } from '@motion-core/gsap-spring';

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
  onSettle: ({ states }) => console.log(states.x),
});

animation.pause();
animation.seek(0.2);
animation.resume();

springTo(element, {
  x: 100,
  spring: { mass: 1, stiffness: 180, damping: 24 },
});
```

Built-in transform conveniences are `x`, `y`, `scale`, and `rotation`. Add arbitrary numeric GSAP properties through `targets`, or provide `adapters` for values that need custom reads and writes. Target strings accept one numeric value and one unit, such as `24px`, `1.2`, or `30deg`. Unit mismatches throw before animation starts.

Retargeting is automatic. Starting another Motion Core spring on the same target and property samples the active track at the exact handoff time, transfers its analytical position and velocity, and makes the new track the only writer. A configured initial velocity is used only when no active track exists. The registry is shared by `springTo()` and the `motionSpring` plugin, while unrelated properties remain independent.

Register the special-property plugin when you want standard GSAP composition and context cleanup:

```ts
import { gsap } from 'gsap';
import { registerMotionCoreSpringPlugin } from '@motion-core/gsap-spring';

registerMotionCoreSpringPlugin(gsap);

gsap.to(element, {
  motionSpring: {
    x: 600,
    parameters: { mass: 1, stiffness: 180, damping: 24 },
  },
});
```

Overlapping springs in a timeline use the same automatic handoff:

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

Direct and incremental seeks produce the same handoff. Reversing before the second tween starts, killing it, or reverting its GSAP context restores ownership to the previous track without a position jump.

For an unsettled trajectory, choose `stop`, `snap`, `continue`, or `error`. The default is `stop` at `maxDuration`. `continue` uses an infinite GSAP clock and must be stopped or killed by the caller.

## Export CSS `linear()` easing

```ts
import { createSpring } from '@motion-core/spring';
import { springToCSSLinear } from '@motion-core/spring/css';

const spring = createSpring({
  from: 0,
  to: 1,
  mass: 1,
  stiffness: 180,
  damping: 18,
});
const css = springToCSSLinear(spring, { maxError: 0.001 });

element.animate(
  [{ transform: 'translateX(0)' }, { transform: 'translateX(600px)' }],
  { duration: css.duration * 1000, easing: css.easing },
);
```

Sampling is adaptive and seeded by angular frequency to avoid aliasing oscillations. `maxError`, `maxDepth`, and `maxSamples` make the approximation budget explicit.

## Inertia, keyframes, vectors, and coupled systems

The runtime includes target modification, snapping, and a velocity-preserving transition to a boundary spring:

```ts
import { createInertia, snapToGrid } from '@motion-core/spring-runtime';

const inertia = createInertia({
  from: 120,
  velocity: 900,
  min: 0,
  max: 600,
  modifyTarget: snapToGrid(20),
});
```

`createSpringKeyframes()` joins multiple settled segments. `createVectorSpring()` composes independent scalar axes with shared time. `createCoupledSpringSystem()` is an opt-in numerical RK4 solver for particles connected by springs and anchors.

## Settlement and reduced motion

A damped spring approaches equilibrium asymptotically. Motion Core defines rest as both of these conditions remaining true for the complete future tail:

```text
abs(position - target) <= positionEpsilon
abs(velocity) <= velocityEpsilon
```

The solver uses analytical upper bounds, expands the search interval, and refines the first safe boundary. This avoids false rest at a zero crossing. Absolute tolerances mean a longer travel distance can take longer to settle even when the normalized response is identical.

Reduced-motion policy belongs to the consuming interface. When `prefers-reduced-motion: reduce` is active, jump to the target or use a deliberately non-oscillating alternative instead of accelerating the same spring.

## Architecture

`@motion-core/spring` has no DOM, framework, GSAP, or runtime scheduler dependency. All core sampling is deterministic from initial state and absolute time. The runtime depends only on core. The GSAP adapter depends on core and GSAP. Package exports point to compiled JavaScript with declarations and source maps, and packages declare `sideEffects: false`.

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

Generated invariant tests use a fixed seed so failures can be reproduced. The benchmark records scalar sampling throughput and allocation-free sampling separately from allocating `stateAt()` calls.
