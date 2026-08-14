# `@motion-core/gsap-spring`

Analytical Motion Core springs driven by GSAP's clock and property system.

```bash
pnpm add @motion-core/gsap-spring gsap
```

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
  },
});

animation.retarget({ x: 100 });
```

The adapter evaluates analytical position and velocity at GSAP's absolute elapsed time. GSAP controls scheduling and writes; easing does not alter the spring trajectory.

Built-in transform conveniences are `x`, `y`, `scale`, and `rotation`. Use `targets` for other numeric GSAP properties, `properties` for per-property physics and velocity, and `adapters` for custom reads and writes. A target can be a number or a single-unit string such as `24px` or `30deg`.

For standard GSAP composition, register the special-property plugin:

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

Unsettled policies are `stop`, `snap`, `continue`, and `error`. The default is `stop`. The controller supports play, pause, resume, seek, reverse playback, retarget, stop, and kill.

The package is ESM-only and requires `@motion-core/spring` and GSAP.
