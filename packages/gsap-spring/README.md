# `@motion-core/gsap-spring`

Analytical Motion Core springs driven by GSAP's clock and property system.

```bash
pnpm add @motion-core/gsap-spring gsap
```

```ts
import { springTo } from '@motion-core/gsap-spring';

const spring = {
  mass: 1,
  stiffness: 180,
  damping: 24,
};

const animation = springTo(element, {
  x: 600,
  rotation: '30deg',
  velocity: { x: 1250 },
  spring,
});

springTo(element, { x: 100, spring });
```

The adapter evaluates analytical position and velocity at GSAP's absolute elapsed time. GSAP controls scheduling and writes; easing does not alter the spring trajectory.

Starting another Motion Core spring on the same target and property retargets it automatically. The new track inherits the active analytical position and velocity, even when you provide another initial velocity. Explicit velocity applies only when there is no active track. `springTo()` and the `motionSpring` plugin share the same per-target, per-property registry.

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

The same behavior applies to overlapping timeline children:

```ts
gsap
  .timeline()
  .to(element, {
    motionSpring: {
      x: 320,
      parameters: spring,
    },
  })
  .to(
    element,
    {
      motionSpring: {
        x: 80,
        parameters: { ...spring, stiffness: 240 },
      },
    },
    '<0.2',
  );
```

Handoffs are sampled at the exact timeline start time, so direct seek and frame-by-frame playback agree. Reverse, kill, property kill, and context revert return ownership to the previous track when appropriate. Tracks for other properties continue independently. Units carry across a handoff; changing a property to an incompatible unit throws before the new spring starts.

Unsettled policies are `stop`, `snap`, `continue`, and `error`. The default is `stop`. The controller supports play, pause, resume, seek, reverse playback, stop, and kill.

The package is ESM-only and requires `@motion-core/spring` and GSAP.
