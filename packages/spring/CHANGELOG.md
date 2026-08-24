# Changelog

This file records user-visible changes to `@motion-core/spring`.

## 0.1.0 - Unreleased

- Add the `motionSpring` GSAP plugin with solver-derived duration and analytical
  sampling.
- Add the preflighted `timeline.motionSpring()` effect and
  `createMotionSpringTween()` helper so derived durations are available before
  GSAP lays out sequential, staggered, or nested timelines.
- Add automatic position and velocity handoff between overlapping timeline and
  `springTo()` tracks.
- Add controller playback, lifecycle callbacks, custom property adapters, unit
  handling, and explicit unsettled-spring policies.
- Ship the analytical solver and supporting parameter, velocity, keyframe,
  inertia, additive, vector, CSS `linear()`, and coupled-system utilities in one
  package.
- Add ESM entry points for the root package, `@motion-core/spring/css`, and
  `@motion-core/spring/coupled`, with TypeScript declarations and source maps.
