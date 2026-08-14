# `@motion-core/spring-runtime`

Frame-driven spring values, gesture velocity, keyframes, inertia, and bounds for Motion Core.

```bash
pnpm add @motion-core/spring-runtime
```

```ts
import { createSpringValue } from '@motion-core/spring-runtime';

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

value.on('change', (snapshot) => console.log(snapshot.value));
value.setTarget(600);
```

Driver timestamps are seconds and must be monotonic. Retargeting samples the current analytical position and velocity before it starts the next trajectory. Optional parameter blending preserves both position and velocity across a tuning change.

The package also exports:

- `createAdditiveSpringValue()` for explicitly additive, overlapping spring effects;
- `velocityFromSamples()`, `normalizedVelocity()`, and `physicalVelocity()` for gesture handoff;
- `createSpringKeyframes()` for sequential spring segments;
- `createInertia()` for targeted decay with optional min/max boundary springs;
- `snapToGrid()` as an inertia target modifier.

`SpringValue` events are `change`, `logicalComplete`, `settle`, and `unsettled`. Call `destroy()` when the owner is disposed.

Use `createSpringValue()` for persistent replacement semantics. Use `createAdditiveSpringValue()` when `animateBy()` contributions should coexist and sum. The separate factories keep interruption behavior explicit.

The package is ESM-only and requires `@motion-core/spring`.
