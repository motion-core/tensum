# Changelog

This file records user-visible changes to `@motion-core/spring`.

## 0.1.0 - Unreleased

- Add the `motionSpring` GSAP plugin with solver-derived duration and analytical
  sampling.
- Add the preflighted `timeline.motionSpring()` effect and
  `createMotionSpringTween()` helper so derived durations are available before
  GSAP lays out sequential, staggered, or nested timelines. Add `from` for an
  explicit construction-time starting snapshot and `tween` for finite stagger,
  repeat, repeat delay, and yoyo options.
- Keep the lazy `gsap.to({ motionSpring: ... })` special property for direct
  tweens and explicitly positioned timeline children. Sequential composition
  uses `timeline.motionSpring()` because GSAP lays out lazy special-property
  tweens before their derived duration is known.
- Add automatic position and velocity handoff between overlapping timeline and
  `springTo()` tracks. Normal completion retains a terminal analytical state,
  discards covered history, and reconciles an external property write before a
  later implicit handoff.
- Add controller playback, lifecycle callbacks, custom property adapters, unit
  handling, property-level kill, invalidate cleanup, and cycle-local
  repeat/yoyo handoff. Plugin lifecycle callbacks are target-scoped for array
  tweens.
- Add explicit unsettled policies: `stop` retains the capped analytical state,
  `snap` writes the target with zero velocity, `continue` uses an infinite
  total-time driver, and `error` rejects an unsettled track during initialization.
- Ship the analytical solver and supporting parameter, velocity, keyframe,
  inertia, additive, vector, CSS `linear()`, and coupled-system utilities in one
  package.
- Add ESM entry points for the root package, `@motion-core/spring/css`, and
  `@motion-core/spring/coupled`, with TypeScript declarations and source maps.
