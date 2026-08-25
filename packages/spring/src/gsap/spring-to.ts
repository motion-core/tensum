import { createSpring } from '../spring.js';
import type {
  SettlingResult,
  SpringParameters,
  SpringSettleInput,
  SpringSolution,
  SpringState,
} from '../types.js';
import { gsap } from 'gsap';
import {
  activeTrackState,
  reconcileActiveTrackHandoff,
  registerActiveTrack,
} from './active-tracks.js';
import type { ActiveTrackRegistration } from './active-tracks.js';
import { localTimeAt } from './gsap-time.js';
import {
  gsapDriverTime,
  springElapsedTime,
  springTrackState,
  springTrackTiming,
  validateUnsettledPolicy,
} from './spring-track-policy.js';
import type {
  SpringTrackTiming,
  UnsettledPolicy,
} from './spring-track-policy.js';
import {
  retireActiveTrackRegistrations,
  syncActiveTrackRegistration,
} from './track-lifecycle.js';

export const SUPPORTED_PROPERTIES = ['x', 'y', 'scale', 'rotation'] as const;
export type BuiltInSpringProperty = (typeof SUPPORTED_PROPERTIES)[number];
export type SpringProperty = string;
export type SpringTargetValue = number | string;
export type SpringTargets = Readonly<
  Partial<Record<SpringProperty, SpringTargetValue>>
>;
export type SpringVelocities = Readonly<
  Partial<Record<SpringProperty, number>>
>;
type SpringMap<Value> = Readonly<Partial<Record<SpringProperty, Value>>> &
  Readonly<Partial<Record<BuiltInSpringProperty, Value>>>;
export type SpringStateMap = SpringMap<SpringState>;
export type SpringSolutionMap = SpringMap<SpringSolution>;
export type SpringTweenTarget = Exclude<gsap.TweenTarget, string | null>;
export type { UnsettledPolicy } from './spring-track-policy.js';

export interface SpringPropertyAdapter {
  read(target: SpringTweenTarget): number;
  write(target: SpringTweenTarget, value: number): void;
  unit?: string;
}

export interface SpringPropertyOptions extends Partial<SpringParameters> {
  velocity?: number;
  settle?: SpringSettleInput;
}

export interface SpringTrackConfig {
  spring: SpringParameters & { settle?: SpringSettleInput };
  velocity?: number | SpringVelocities;
  properties?: Readonly<Partial<Record<SpringProperty, SpringPropertyOptions>>>;
  adapters?: Readonly<Partial<Record<SpringProperty, SpringPropertyAdapter>>>;
  units?: Readonly<Partial<Record<SpringProperty, string>>>;
}

export interface SpringToSnapshot {
  elapsed: number;
  duration: number;
  states: SpringStateMap;
}

export interface SpringToVars extends SpringTrackConfig {
  x?: SpringTargetValue;
  y?: SpringTargetValue;
  scale?: SpringTargetValue;
  rotation?: SpringTargetValue;
  targets?: SpringTargets;
  /** Behavior when a track reaches `maxDuration` without settling. */
  unsettled?: UnsettledPolicy;
  /** Runs for each rendered update while this controller owns any track. */
  onUpdate?: (snapshot: SpringToSnapshot) => void;
  /** Runs at each forward logical-completion crossing. */
  onLogicalComplete?: (snapshot: SpringToSnapshot) => void;
  /** Runs at each forward physical-settlement crossing. */
  onSettle?: (snapshot: SpringToSnapshot) => void;
  /** Runs at each forward `maxDuration` crossing for an unsettled track. */
  onUnsettled?: (snapshot: SpringToSnapshot) => void;
  /** Runs after the finite GSAP driver completes. */
  onComplete?: () => void;
}

export interface SpringController {
  readonly duration: number;
  readonly springs: SpringSolutionMap;
  readonly tween: gsap.core.Tween;
  getSnapshot(): SpringToSnapshot;
  play(): void;
  pause(): void;
  resume(): void;
  stop(): void;
  seek(time: number): void;
  playbackReverse(): void;
  kill(): void;
}

interface ActiveProperty {
  target: number;
  unit?: string;
  duration: number;
  settling: SettlingResult;
  spring: SpringSolution;
  registration?: ActiveTrackRegistration;
  lastTime: number;
  write: (value: number) => void;
}

interface ActiveProperties extends SpringTrackTiming {
  entries: Record<SpringProperty, ActiveProperty>;
}

export interface RequestedTarget {
  value: number;
  unit?: string;
}

type RequestedTargets = Record<SpringProperty, RequestedTarget>;

export interface ParsedNumericValue {
  value: number;
  unit?: string;
}

const NUMERIC_VALUE =
  /^([+-]?(?:(?:\d+(?:\.\d*)?)|(?:\.\d+))(?:e[+-]?\d+)?)\s*([a-z%]*)$/i;
const UNSAFE_PROPERTY_NAMES = new Set([
  '__proto__',
  'constructor',
  'prototype',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isElementTarget(target: SpringTweenTarget): boolean {
  return (
    typeof target === 'object' &&
    target !== null &&
    'nodeType' in target &&
    target.nodeType === 1
  );
}

function validatePropertyName(property: string): void {
  if (property.trim().length === 0 || UNSAFE_PROPERTY_NAMES.has(property)) {
    throw new TypeError(`Invalid spring property: ${property || '(empty)'}`);
  }
}

function validateOptionalRecord(value: unknown, name: string): void {
  if (value !== undefined && !isRecord(value)) {
    throw new TypeError(`${name} must be an object when provided`);
  }
}

function validateSpringToInput(vars: unknown): asserts vars is SpringToVars {
  if (!isRecord(vars)) {
    throw new TypeError('springTo requires a configuration object');
  }
  if (!isRecord(vars['spring'])) {
    throw new TypeError('springTo requires a spring parameters object');
  }

  validateOptionalRecord(vars['targets'], 'targets');
  validateOptionalRecord(vars['properties'], 'properties');
  validateOptionalRecord(vars['adapters'], 'adapters');
  validateOptionalRecord(vars['units'], 'units');
  if (vars['velocity'] !== undefined && typeof vars['velocity'] !== 'number') {
    validateOptionalRecord(vars['velocity'], 'velocity');
  }

  if (isRecord(vars['velocity'])) {
    for (const [property, value] of Object.entries(vars['velocity'])) {
      validatePropertyName(property);
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new TypeError(`Velocity for ${property} must be a finite number`);
      }
    }
  }
  if (isRecord(vars['units'])) {
    for (const [property, value] of Object.entries(vars['units'])) {
      validatePropertyName(property);
      if (typeof value !== 'string') {
        throw new TypeError(`Unit for ${property} must be a string`);
      }
    }
  }
  if (isRecord(vars['properties'])) {
    for (const [property, value] of Object.entries(vars['properties'])) {
      validatePropertyName(property);
      if (!isRecord(value)) {
        throw new TypeError(`Properties for ${property} must be an object`);
      }
    }
  }
  if (isRecord(vars['adapters'])) {
    for (const [property, value] of Object.entries(vars['adapters'])) {
      validatePropertyName(property);
      if (
        !isRecord(value) ||
        typeof value['read'] !== 'function' ||
        typeof value['write'] !== 'function'
      ) {
        throw new TypeError(
          `Adapter for ${property} must provide read and write functions`,
        );
      }
      if (value['unit'] !== undefined && typeof value['unit'] !== 'string') {
        throw new TypeError(`Adapter unit for ${property} must be a string`);
      }
    }
  }
  for (const callback of [
    'onUpdate',
    'onLogicalComplete',
    'onSettle',
    'onUnsettled',
    'onComplete',
  ] as const) {
    const value = vars[callback];
    if (value !== undefined && typeof value !== 'function') {
      throw new TypeError(`${callback} must be a function when provided`);
    }
  }
}

export function resolveSpringTarget(
  target: gsap.TweenTarget,
): SpringTweenTarget {
  const candidates = gsap.utils.toArray<unknown>(target);
  if (candidates.length !== 1) {
    throw new TypeError(
      `springTo requires exactly one resolved target; received ${candidates.length}`,
    );
  }
  const resolved = candidates[0];
  if (
    ((typeof resolved !== 'object' || resolved === null) &&
      typeof resolved !== 'function') ||
    Array.isArray(resolved)
  ) {
    throw new TypeError('springTo requires exactly one resolved object target');
  }
  return resolved;
}

export function parseNumericValue(
  input: unknown,
  property: SpringProperty,
): ParsedNumericValue {
  validatePropertyName(property);
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) {
      throw new TypeError(`${property} must be a finite numeric value`);
    }
    return { value: input };
  }
  if (typeof input !== 'string') {
    throw new TypeError(
      `${property} must be a number or a single-unit numeric string`,
    );
  }
  const match = NUMERIC_VALUE.exec(input.trim());
  if (!match) {
    throw new TypeError(
      `${property} must be a number or a single-unit numeric string`,
    );
  }
  const value = Number(match[1]);
  if (!Number.isFinite(value)) {
    throw new TypeError(`${property} must contain a finite numeric value`);
  }
  const unit = match[2];
  return unit ? { value, unit } : { value };
}

function requestedTargetsFrom(vars: SpringToVars): RequestedTargets {
  const requested: RequestedTargets = Object.create(null) as RequestedTargets;
  for (const property of SUPPORTED_PROPERTIES) {
    const value = Object.hasOwn(vars, property) ? vars[property] : undefined;
    if (value !== undefined)
      requested[property] = parseNumericValue(value, property);
  }
  for (const [property, value] of Object.entries(vars.targets ?? {})) {
    requested[property] = parseNumericValue(value, property);
  }
  return requested;
}

function defaultUnitFor(property: SpringProperty): string | undefined {
  if (property === 'x' || property === 'y') return 'px';
  if (property === 'rotation') return 'deg';
  return undefined;
}

function resolvedUnit(
  property: SpringProperty,
  requested: RequestedTarget,
  readUnit: string | undefined,
  vars: SpringTrackConfig,
): string | undefined {
  const adapterUnit = vars.adapters?.[property]?.unit;
  const hasConfiguredUnit = Object.hasOwn(vars.units ?? {}, property);
  const configuredUnit = hasConfiguredUnit
    ? vars.units?.[property] || undefined
    : undefined;
  const unit =
    requested.unit ??
    adapterUnit ??
    configuredUnit ??
    (hasConfiguredUnit ? undefined : defaultUnitFor(property)) ??
    readUnit;

  for (const candidate of [
    requested.unit,
    adapterUnit,
    configuredUnit,
    readUnit,
  ]) {
    if (candidate !== undefined && unit !== undefined && candidate !== unit) {
      throw new TypeError(
        `Unit mismatch for ${property}: expected ${unit}, received ${candidate}`,
      );
    }
  }
  return unit;
}

export function accessFor(
  target: SpringTweenTarget,
  property: SpringProperty,
  requested: RequestedTarget,
  vars: SpringTrackConfig,
): { from: number; unit?: string; write: (value: number) => void } {
  const adapter = Object.hasOwn(vars.adapters ?? {}, property)
    ? vars.adapters?.[property]
    : undefined;
  if (adapter !== undefined) {
    if (
      adapter === null ||
      typeof adapter !== 'object' ||
      typeof adapter.read !== 'function' ||
      typeof adapter.write !== 'function'
    ) {
      throw new TypeError(
        `Adapter for ${property} must provide read and write functions`,
      );
    }
    const from = adapter.read(target);
    if (!Number.isFinite(from)) {
      throw new TypeError(
        `Adapter for ${property} returned a non-finite value`,
      );
    }
    const unit = resolvedUnit(property, requested, undefined, vars);
    return {
      from,
      ...(unit === undefined ? {} : { unit }),
      write(value: number): void {
        adapter.write(target, value);
      },
    };
  }

  const raw = parseNumericValue(
    gsap.getProperty(target, property, 'native'),
    property,
  );
  const unit = resolvedUnit(property, requested, raw.unit, vars);
  const setters =
    property === 'scale' && isElementTarget(target)
      ? [
          gsap.quickSetter(target, 'scaleX', unit),
          gsap.quickSetter(target, 'scaleY', unit),
        ]
      : [gsap.quickSetter(target, property, unit)];
  return {
    from: raw.value,
    ...(unit === undefined ? {} : { unit }),
    write(value: number): void {
      for (const setter of setters) setter(value);
    },
  };
}

export function velocityFor(
  velocity: SpringTrackConfig['velocity'],
  property: SpringProperty,
): number {
  const resolved =
    typeof velocity === 'number' ? velocity : (velocity?.[property] ?? 0);
  if (!Number.isFinite(resolved)) {
    throw new TypeError(`Velocity for ${property} must be a finite number`);
  }
  return resolved;
}

export function optionsFor(
  vars: SpringTrackConfig,
  property: SpringProperty,
): SpringParameters & { settle?: SpringSettleInput } {
  const propertyOptions = Object.hasOwn(vars.properties ?? {}, property)
    ? vars.properties?.[property]
    : undefined;
  if (
    propertyOptions !== undefined &&
    (typeof propertyOptions !== 'object' ||
      propertyOptions === null ||
      Array.isArray(propertyOptions))
  ) {
    throw new TypeError(`Properties for ${property} must be an object`);
  }
  const commonSettle = vars.spring.settle;
  const propertySettle = propertyOptions?.settle;

  return {
    mass: propertyOptions?.mass ?? vars.spring.mass,
    stiffness: propertyOptions?.stiffness ?? vars.spring.stiffness,
    damping: propertyOptions?.damping ?? vars.spring.damping,
    ...(commonSettle || propertySettle
      ? { settle: { ...commonSettle, ...propertySettle } }
      : {}),
  };
}

/**
 * Animates numeric properties with GSAP as a clock only. Position and velocity
 * always come from closed-form spring samples at absolute time.
 */
export function springTo(
  target: gsap.TweenTarget,
  vars: SpringToVars,
): SpringController {
  validateSpringToInput(vars);
  const springTarget = resolveSpringTarget(target);
  const requestedTargets = requestedTargetsFrom(vars);

  if (Object.keys(requestedTargets).length === 0) {
    throw new TypeError(
      'springTo requires at least one numeric target property',
    );
  }

  const unsettledPolicy = validateUnsettledPolicy(vars.unsettled ?? 'stop');
  const clock = { elapsed: 0 };
  let active: Record<SpringProperty, ActiveProperty> = {};
  let tween: gsap.core.Tween;
  let duration = 0;
  let finiteDuration = 0;
  let driverDuration = 0;
  let hasUnsettled = false;
  let didComplete = false;
  let didLogicalComplete = false;
  let didSettle = false;
  let didNotifyUnsettled = false;
  let killed = false;

  const buildProperties = (targets: RequestedTargets): ActiveProperties => {
    const next: Record<SpringProperty, ActiveProperty> = {};

    for (const [property, requested] of Object.entries(targets)) {
      const to = requested.value;
      let inherited = activeTrackState(springTarget, property);
      const resolvedRequest =
        requested.unit === undefined &&
        !inherited?.terminal &&
        inherited?.unit !== undefined
          ? { ...requested, unit: inherited.unit }
          : requested;
      const access = accessFor(springTarget, property, resolvedRequest, vars);
      inherited = reconcileActiveTrackHandoff(
        springTarget,
        property,
        inherited,
        access.from,
        access.unit,
      );
      if (
        inherited?.unit !== undefined &&
        access.unit !== undefined &&
        inherited.unit !== access.unit
      ) {
        throw new TypeError(
          `Unit mismatch for ${property}: expected ${inherited.unit}, received ${access.unit}`,
        );
      }
      const from = inherited?.position ?? access.from;
      const velocity =
        inherited?.velocity ??
        vars.properties?.[property]?.velocity ??
        velocityFor(vars.velocity, property);
      const spring = createSpring({
        from,
        to,
        velocity,
        ...optionsFor(vars, property),
      });
      const settling = spring.getSettlingResult();
      const propertyDuration = settling.duration;
      next[property] = {
        target: to,
        ...(access.unit === undefined ? {} : { unit: access.unit }),
        duration: propertyDuration,
        settling,
        spring,
        lastTime: 0,
        write: access.write,
      };
    }

    const timing = springTrackTiming(Object.values(next), unsettledPolicy);
    return {
      entries: next,
      ...timing,
    };
  };

  const activate = (next: ActiveProperties): void => {
    if (unsettledPolicy === 'error' && next.hasUnsettled) {
      throw new RangeError(
        'springTo cannot start an unsettled spring in error mode',
      );
    }

    active = next.entries;
    finiteDuration = next.finiteDuration;
    driverDuration = next.driverDuration;
    hasUnsettled = next.hasUnsettled;
    duration =
      unsettledPolicy === 'continue' && hasUnsettled
        ? Number.POSITIVE_INFINITY
        : finiteDuration;
  };

  const stateFor = (entry: ActiveProperty, elapsed: number): SpringState =>
    springTrackState(entry, elapsed, unsettledPolicy);

  const snapshotAt = (
    elapsed: number,
    entries: Readonly<Record<SpringProperty, ActiveProperty>> = active,
  ): SpringToSnapshot => {
    const states: Record<SpringProperty, SpringState> = {};
    for (const [property, entry] of Object.entries(entries)) {
      states[property] = stateFor(entry, elapsed);
    }
    return {
      elapsed: Number.isFinite(duration)
        ? Math.min(elapsed, duration)
        : elapsed,
      duration,
      states: states as SpringStateMap,
    };
  };

  const timingFor = (
    entries: Readonly<Record<SpringProperty, ActiveProperty>>,
  ): SpringTrackTiming =>
    springTrackTiming(Object.values(entries), unsettledPolicy);

  const notifyUnsettled = (
    snapshot: SpringToSnapshot,
    timing: SpringTrackTiming,
  ): void => {
    if (
      killed ||
      didNotifyUnsettled ||
      !timing.hasUnsettled ||
      snapshot.elapsed < timing.unsettledAt
    ) {
      return;
    }

    didNotifyUnsettled = true;
    vars.onUnsettled?.(snapshot);
  };

  const notifyTiming = (
    snapshot: SpringToSnapshot,
    timing: SpringTrackTiming,
  ): void => {
    if (killed) return;
    if (snapshot.elapsed < timing.logicalDuration) didLogicalComplete = false;
    if (snapshot.elapsed < timing.finiteDuration) didSettle = false;
    if (snapshot.elapsed < timing.unsettledAt) didNotifyUnsettled = false;

    if (!didLogicalComplete && snapshot.elapsed >= timing.logicalDuration) {
      didLogicalComplete = true;
      vars.onLogicalComplete?.(snapshot);
    }
    if (
      !timing.hasUnsettled &&
      !didSettle &&
      snapshot.elapsed >= timing.finiteDuration
    ) {
      didSettle = true;
      vars.onSettle?.(snapshot);
    }
  };

  const render = (notifyUpdate = true): SpringToSnapshot => {
    const owners: Record<SpringProperty, ActiveProperty> = {};
    for (const [property, entry] of Object.entries(active)) {
      const registration = entry.registration;
      if (!registration) continue;
      const transition = syncActiveTrackRegistration(
        registration,
        clock.elapsed,
        entry.lastTime,
      );
      entry.lastTime = clock.elapsed;
      if (transition.releasedAtStart) {
        if (!transition.restoredPrevious)
          entry.write(stateFor(entry, 0).position);
        continue;
      }
      if (transition.isOwner) owners[property] = entry;
    }

    const snapshot = snapshotAt(clock.elapsed, owners);
    for (const [property, entry] of Object.entries(owners)) {
      const state = snapshot.states[property];
      if (state) entry.write(state.position);
    }
    if (Object.keys(owners).length === 0) return snapshot;
    const timing = timingFor(owners);
    if (notifyUpdate) vars.onUpdate?.(snapshot);
    notifyTiming(snapshot, timing);
    notifyUnsettled(snapshot, timing);
    return snapshot;
  };

  const complete = (): void => {
    if (killed || didComplete) return;
    clock.elapsed = finiteDuration;
    const snapshot = render(false);
    retireActiveTrackRegistrations(
      Object.values(active).map((entry) => entry.registration),
    );
    didComplete = true;
    if (Object.keys(snapshot.states).length === 0) return;
    vars.onComplete?.();
  };

  const releaseRegistrations = (): void => {
    for (const entry of Object.values(active)) entry.registration?.release();
  };

  const withInterruptCleanup = (
    runningTween: gsap.core.Tween,
  ): gsap.core.Tween => {
    const previousInterrupt = runningTween.eventCallback('onInterrupt');
    runningTween.eventCallback('onInterrupt', () => {
      releaseRegistrations();
      previousInterrupt?.();
    });
    return runningTween;
  };

  const startClock = (): gsap.core.Tween => {
    clock.elapsed = 0;
    didComplete = false;
    didLogicalComplete = false;
    didSettle = false;
    didNotifyUnsettled = false;

    if (finiteDuration === 0) {
      render();
      return withInterruptCleanup(
        gsap.to(clock, { elapsed: 0, duration: 0, onComplete: complete }),
      );
    }

    if (unsettledPolicy === 'continue' && hasUnsettled) {
      let runningTween: gsap.core.Tween;
      runningTween = gsap.to(clock, {
        elapsed: 1,
        duration: 1,
        repeat: -1,
        ease: 'none',
        onUpdate() {
          clock.elapsed = runningTween.totalTime();
          render();
        },
      });
      return withInterruptCleanup(runningTween);
    }

    return withInterruptCleanup(
      gsap.to(clock, {
        elapsed: finiteDuration,
        duration: driverDuration,
        ease: 'none',
        onUpdate: render,
        onComplete: complete,
      }),
    );
  };

  activate(buildProperties(requestedTargets));
  for (const [property, entry] of Object.entries(active)) {
    entry.registration = registerActiveTrack(springTarget, property, {
      state: (globalTime) => {
        const elapsed =
          globalTime === undefined || tween === undefined
            ? clock.elapsed
            : Number.isFinite(duration)
              ? springElapsedTime(
                  localTimeAt(tween, globalTime),
                  finiteDuration,
                  driverDuration,
                )
              : localTimeAt(tween, globalTime);
        const state = stateFor(entry, elapsed);
        return {
          ...state,
          velocity: state.velocity * (tween?.reversed() ? -1 : 1),
          ...(entry.unit === undefined ? {} : { unit: entry.unit }),
        };
      },
      restore: () => {
        entry.write(stateFor(entry, clock.elapsed).position);
      },
    });
  }
  tween = startClock();

  const controller: SpringController = {
    get duration() {
      return duration;
    },
    get springs() {
      return Object.fromEntries(
        Object.entries(active).map(([property, entry]) => [
          property,
          entry.spring,
        ]),
      );
    },
    get tween() {
      return tween;
    },
    getSnapshot() {
      return snapshotAt(clock.elapsed);
    },
    play() {
      if (!killed) tween.play();
    },
    pause() {
      if (!killed) tween.pause();
    },
    resume() {
      if (!killed) tween.resume();
    },
    stop() {
      if (!killed) tween.pause();
    },
    seek(time) {
      if (killed) return;
      if (!Number.isFinite(time) || time < 0) {
        throw new RangeError(
          'seek time must be a finite number greater than or equal to 0',
        );
      }
      const resolvedTime = Number.isFinite(duration)
        ? Math.min(time, duration)
        : time;
      if (Number.isFinite(duration)) {
        tween.time(
          gsapDriverTime(resolvedTime, finiteDuration, driverDuration),
          false,
        );
      } else tween.totalTime(resolvedTime, false);
    },
    playbackReverse() {
      if (!killed) tween.reverse();
    },
    kill() {
      if (killed) return;
      killed = true;
      releaseRegistrations();
      tween.kill();
    },
  };

  return controller;
}
