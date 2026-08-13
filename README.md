# real-spring

`real-spring` is an experimental TypeScript spring engine with a GSAP clock adapter and a compact SvelteKit lab.

The central rule is simple:

> Duration is output, not input.

The public spring configuration contains physical state and settling tolerances. It does not contain a duration or an easing curve.

## Workspace

```text
spring-core
    ↓
gsap-spring
    ↓
SvelteKit lab
```

- `@real-spring/spring-core` has no browser, Svelte, or GSAP dependency. It validates input, solves the spring, determines settlement, and creates momentum-preserving retargeted springs.
- `@real-spring/gsap-spring` uses GSAP as a clock and renderer. Its `springTo()` adapter currently supports `x`, `y`, `scale`, and `rotation`.
- `@real-spring/lab` is a Svelte 5 development instrument built with Tailwind CSS and shadcn-svelte preset `bK05dzlM8`.

Internal packages are linked with `workspace:*`.

## Physics

The core solves the damped harmonic oscillator:

```text
m x'' + c x' + k(x - target) = 0
```

The implementation works with displacement from equilibrium, `y = x - target`. For mass `m`, stiffness `k`, and damping `c`:

```text
ω₀ = sqrt(k / m)
ζ  = c / (2 sqrt(km))
```

The damping ratio selects one of three closed-form solutions:

- `ζ < 1`: underdamped
- `ζ ≈ 1`: critically damped
- `ζ > 1`: overdamped

Critical damping uses a small floating-point tolerance instead of exact equality. Each call to `stateAt(t)` evaluates the analytical solution from its initial conditions and absolute time. Previous samples and frame rate have no effect on the result.

Velocity is stored in the same physical unit system as position per second. The core is unit-agnostic; the lab happens to use pixels and pixels per second.

## Core API

```ts
import { createSpring } from '@real-spring/spring-core';

const spring = createSpring({
  from: 0,
  to: 600,
  velocity: 0,
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
spring.getSettlingDuration();
```

Invalid mass, stiffness, damping, thresholds, state, or time values throw `RangeError`. Failing early is intentional while the API is experimental.

Retargeting samples the old spring once, then uses that position and velocity as the new spring's initial state:

```ts
const next = spring.retarget(100, 0.25);
```

No momentum is discarded unless the caller explicitly starts a new spring with zero velocity.

## Settlement

A damped spring approaches equilibrium asymptotically, so exact mathematical rest takes infinite time. The engine needs a visual definition of rest:

```text
abs(position - target) <= positionEpsilon
abs(velocity) <= velocityEpsilon
```

Testing only the current sample is unsafe for an underdamped spring. It can cross both thresholds and leave them again on the next oscillation.

The current implementation builds analytical upper bounds for all future position error and speed. It expands the search interval until both bounds are below their absolute tolerances, then refines the result with binary search. The default maximum search horizon is 60 seconds. A non-equilibrium spring with zero damping reports `settled: false`.

This method is deliberately conservative. It may return a slightly later time than a dense visual sampling method, but it cannot mistake a zero crossing for permanent settlement.

## Distance and duration

The normalized response of a linear spring is independent of amplitude. Measured settling time can still change with distance when the thresholds are absolute rather than normalized.

With the current baseline parameters:

```text
mass = 1
stiffness = 180
damping = 24
initial velocity = 0
position epsilon = 0.1
velocity epsilon = 0.1
```

the solver returns:

| Movement | Settling duration |
| --- | ---: |
| `0 → 10` | `0.667197 s` |
| `0 → 100` | `0.859079 s` |
| `0 → 1000` | `1.050961 s` |

These values come from the spring state and tolerances. There is no `distance × factor` duration rule. Unit tests repeat this comparison instead of hard-coding those exact numbers.

## GSAP adapter

`springTo()` creates one analytical spring per requested property. The longest computed settling duration becomes the private duration of a linear GSAP clock tween. On each update, the adapter reads absolute elapsed time and asks the core for the corresponding state.

```ts
import { springTo } from '@real-spring/gsap-spring';

const animation = springTo(element, {
  x: 600,
  velocity: { x: 1250 },
  spring: {
    mass: 1,
    stiffness: 180,
    damping: 24,
    settle: { position: 0.1, velocity: 0.1 },
  },
});

animation.retarget({ x: 100 });
```

GSAP schedules rendering; it does not calculate the trajectory. Completion writes the exact requested target. Retargeting starts a fresh GSAP clock with the current analytical position and velocity.

The special-property form `gsap.to(target, { realSpring: ... })` has not been implemented yet. `springTo()` is the smaller integration boundary used to validate timing and interruption first.

## Lab

The lab exposes target, mass, stiffness, damping, initial velocity, and both settling thresholds. It shows damping ratio, regime, computed duration, live position, live velocity, elapsed time, and lightweight position/velocity plots.

Quick actions run identical parameters at 100, 500, and 1000 pixels. The main lab fits a 768×720 viewport without page scrolling. On narrower screens it returns to normal document flow. shadcn card padding and component sizes come from the compact preset rather than page-level overrides.

If `prefers-reduced-motion: reduce` is active, animation completes immediately. The inspection switch can temporarily enable the physical trajectory for development work.

## Commands

Install and run the lab:

```bash
pnpm install
pnpm dev
```

Validate the whole workspace:

```bash
pnpm test
pnpm check
pnpm lint
pnpm build
```

## Current limits

- Every property is currently an independent scalar spring. Coupled or vector springs are not implemented.
- `springTo()` supports transform properties only. It does not attempt to cover the full GSAP CSSPlugin surface.
- Mid-flight retargeting preserves analytical velocity, but automatic inheritance from arbitrary non-spring GSAP tweens or pointer trackers is not available.
- The settling search uses conservative tail bounds. A future implementation may tighten critical and overdamped bounds without changing the public API.
- Package exports point to TypeScript source for workspace development. A publishable release needs a finalized build/export policy and API compatibility guarantees.

## Status

All public APIs are experimental. The next useful steps are:

1. add a formal GSAP special-property plugin without changing the solver;
2. add pointer-velocity capture and transfer into `springTo()`;
3. benchmark the analytical solver and settlement search across large batches of springs.
