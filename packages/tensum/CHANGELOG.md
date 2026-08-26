# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-08-26

### Changed

- GSAP registration now follows the native plugin convention with
  `gsap.registerPlugin(TensumPlugin)` instead of `registerSpringPlugin(gsap)`.
- The preflighted GSAP timeline effect is now `timeline.spring()` instead of
  `timeline.motionSpring()`; derived duration, stagger, nesting, repeat, yoyo,
  lifecycle callbacks, and velocity handoff retain the same behavior.
- Numeric `x`, `y`, and `rotation` properties on ordinary objects now remain
  unitless. DOM transforms retain their `px` and `deg` defaults, while explicit
  value, adapter, and `units` configuration continues to take precedence.
- The supported platform contract is now the tested Node.js 20.19, 22.12, and
  24 lines; ES2022 Chromium, Firefox, and WebKit engines; TypeScript 6; ESM;
  and GSAP `^3.15.0`.

### Removed

- Removed the unobservable `timing` fields from `AdditiveSpringOptions` and
  `AdditiveSpringContributionOptions`. Runtime calls that still provide those
  fields now fail with a migration error.

### Fixed

- `createSpringValue()` now emits `logicalComplete` before `settle` when
  physical settlement ends the driver before the requested perceptual
  duration, instead of silently losing logical completion.
- `springToCSSLinear()` now certifies `maxError` for the serialized CSS curve
  using an analytical acceleration bound, including rounded progress values,
  rounded stop positions, and the terminal target. It throws when duration or
  sampling limits make the requested guarantee impossible.

### Added

- Release checks now pin every named public value and type export for all three
  package entry points and run real-browser integration in Chromium, Firefox,
  and WebKit.

## [0.1.0] - 2026-08-26

### Added

- Analytical solutions for underdamped, critically damped, and overdamped
  springs, with position, velocity, state, and retargeting APIs.
- Settlement detection with configurable position and velocity tolerances,
  maximum duration, and refinement precision.
- Physical and perceptual parameter converters, spring presets, damping
  classification, and spring characteristic inspection.
- GSAP timeline composition through `timeline.motionSpring()` and
  `createMotionSpringTween()`, with solver-derived duration available before
  timeline layout.
- Direct animation control through `springTo()`, including pause, resume, seek,
  reverse playback, snapshots, and property-level cancellation.
- Position and velocity handoff between overlapping Tensum tracks, including
  terminal-state retention and external-write detection.
- Multi-property and multi-target animation with unit validation, custom
  property adapters, stagger, repeat, repeat delay, and yoyo playback.
- Lifecycle callbacks for logical completion, physical settlement, and
  unsettled springs.
- `stop`, `snap`, `continue`, and `error` policies for springs that do not settle
  within their configured maximum duration.
- Vector springs, reactive spring values, additive composition, analytical
  keyframes, inertia, velocity helpers, and snapping utilities.
- CSS `linear()` generation through `tensum/css` and coupled spring systems
  through `tensum/coupled`.
- ESM package exports with TypeScript declarations, declaration maps, source
  maps, and included TypeScript sources.
