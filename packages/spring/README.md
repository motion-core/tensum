# `@motion-core/spring`

Analytical spring physics as a GSAP plugin.

```bash
pnpm add @motion-core/spring gsap
```

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

GSAP owns the clock, timeline, lifecycle, and property writes. The plugin evaluates analytical spring state from absolute elapsed time, so frame rate and previous samples do not change the trajectory.

The plugin derives duration from physical parameters and settling tolerances. A public spring configuration does not require `duration`.

## Timeline handoff

Overlapping `motionSpring` tweens on the same target and property share a track registry. The newer tween inherits the current analytical position and velocity and becomes the only writer. Pause, seek, reverse, `timeScale`, kill, and GSAP context cleanup keep their normal GSAP semantics.

```ts
gsap
  .timeline()
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

## Controller API

Use `springTo()` when code needs direct playback controls:

```ts
import { springTo } from '@motion-core/spring';

const animation = springTo(element, {
  x: 600,
  velocity: { x: 1250 },
  spring: { mass: 1, stiffness: 180, damping: 24 },
});

animation.pause();
animation.seek(0.2);
animation.resume();
```

Built-in transforms are `x`, `y`, `scale`, and `rotation`. Arbitrary numeric properties and custom adapters are also supported.

The package retains the analytical solver and existing supporting utilities in one distribution. They are implementation and migration tools, not separate Motion Core products. CSS `linear()` export and coupled systems remain available from `@motion-core/spring/css` and `@motion-core/spring/coupled`.

The package is ESM-only, requires GSAP as a peer dependency, and supports Node.js 18 or newer for development and server-side use.
