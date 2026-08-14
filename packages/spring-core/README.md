# `@motion-core/spring`

DOM-free analytical spring physics for JavaScript and TypeScript.

```bash
pnpm add @motion-core/spring
```

```ts
import { createSpring, springPresets } from '@motion-core/spring';

const spring = createSpring({
  from: 0,
  to: 600,
  velocity: 1250,
  ...springPresets.snappy(),
  settle: { position: 0.1, velocity: 0.1 },
});

const state = spring.stateAt(0.25);
const result = spring.getSettlingResult();
const redirected = spring.retarget(100, 0.25);
```

Time is measured in seconds. Velocity is position units per second. Sampling uses absolute time and is independent of frame rate or previous samples.

The root package exports:

- stable underdamped, critically damped, and overdamped analytical solutions;
- conservative future-tail settlement detection;
- physical, response, perceptual-duration, visual-duration, and settling-duration parameter converters;
- `smooth`, `snappy`, and `bouncy` parameter presets;
- an isolated Motion `13.1.0` duration compatibility profile;
- scalar `SpringModel` and independent-axis vector composition.

Use `@motion-core/spring/css` for adaptive CSS `linear()` export and `@motion-core/spring/coupled` for the opt-in RK4 coupled-system solver.

An undamped moving spring returns `{ settled: false }` at `maxDuration`. Consumers must choose whether to stop, snap, continue, or reject that animation.

The package is ESM-only, has no runtime dependencies, and requires Node.js 18 or newer for server-side use.
