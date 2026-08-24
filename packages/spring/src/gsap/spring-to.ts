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
  registerActiveTrack,
} from './active-tracks.js';
import type { ActiveTrackRegistration } from './active-tracks.js';
import { localTimeAt } from './gsap-time.js';

export const SUPPORTED_PROPERTIES = ['x', 'y', 'scale', 'rotation'] as const;
export type BuiltInSpringProperty = (typeof SUPPORTED_PROPERTIES)[number];
export type SpringProperty = string;
export type SpringTargetValue = number | string;
export type SpringTargets = Readonly<Record<SpringProperty, SpringTargetValue>>;
export type SpringVelocities = Readonly<Record<SpringProperty, number>>;
export type UnsettledPolicy = 'continue' | 'stop' | 'snap' | 'error';
export type SpringStateMap = Readonly<Record<SpringProperty, SpringState>> &
  Readonly<Partial<Record<BuiltInSpringProperty, SpringState>>>;
export type SpringSolutionMap = Readonly<Record<SpringProperty, SpringSolution>> &
  Readonly<Partial<Record<BuiltInSpringProperty, SpringSolution>>>;

export interface SpringPropertyAdapter {
  read(target: gsap.TweenTarget): number;
  write(target: gsap.TweenTarget, value: number): void;
  unit?: string;
}

export interface SpringPropertyOptions extends Partial<SpringParameters> {
  velocity?: number;
  settle?: SpringSettleInput;
}

export interface SpringTrackConfig {
  spring: SpringParameters & { settle?: SpringSettleInput };
  velocity?: number | SpringVelocities;
  properties?: Readonly<Record<SpringProperty, SpringPropertyOptions>>;
  adapters?: Readonly<Record<SpringProperty, SpringPropertyAdapter>>;
  units?: Readonly<Record<SpringProperty, string>>;
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
  unsettled?: UnsettledPolicy;
  onUpdate?: (snapshot: SpringToSnapshot) => void;
  onLogicalComplete?: (snapshot: SpringToSnapshot) => void;
  onSettle?: (snapshot: SpringToSnapshot) => void;
  onUnsettled?: (snapshot: SpringToSnapshot) => void;
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

interface ActiveProperties {
  entries: Record<SpringProperty, ActiveProperty>;
  finiteDuration: number;
  logicalDuration: number;
  hasUnsettled: boolean;
  unsettledAt: number;
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

export function parseNumericValue(
  input: unknown,
  property: SpringProperty,
): ParsedNumericValue {
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) {
      throw new TypeError(`${property} must be a finite numeric value`);
    }
    return { value: input };
  }
  if (typeof input !== 'string') {
    throw new TypeError(`${property} must be a number or a single-unit numeric string`);
  }
  const match = NUMERIC_VALUE.exec(input.trim());
  if (!match) {
    throw new TypeError(`${property} must be a number or a single-unit numeric string`);
  }
  const value = Number(match[1]);
  if (!Number.isFinite(value)) {
    throw new TypeError(`${property} must contain a finite numeric value`);
  }
  const unit = match[2];
  return unit ? { value, unit } : { value };
}

function requestedTargetsFrom(vars: SpringToVars): RequestedTargets {
  const requested: RequestedTargets = {};
  for (const property of SUPPORTED_PROPERTIES) {
    const value = vars[property];
    if (value !== undefined) requested[property] = parseNumericValue(value, property);
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
  const configuredUnit = hasConfiguredUnit ? vars.units?.[property] || undefined : undefined;
  const unit =
    requested.unit ??
    adapterUnit ??
    configuredUnit ??
    (hasConfiguredUnit ? undefined : defaultUnitFor(property)) ??
    readUnit;

  for (const candidate of [requested.unit, adapterUnit, configuredUnit, readUnit]) {
    if (candidate !== undefined && unit !== undefined && candidate !== unit) {
      throw new TypeError(`Unit mismatch for ${property}: expected ${unit}, received ${candidate}`);
    }
  }
  return unit;
}

export function accessFor(
  target: gsap.TweenTarget,
  property: SpringProperty,
  requested: RequestedTarget,
  vars: SpringTrackConfig,
): { from: number; unit?: string; write: (value: number) => void } {
  const adapter = vars.adapters?.[property];
  if (adapter) {
    const from = adapter.read(target);
    if (!Number.isFinite(from)) {
      throw new TypeError(`Adapter for ${property} returned a non-finite value`);
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

  const raw = parseNumericValue(gsap.getProperty(target, property), property);
  const unit = resolvedUnit(property, requested, raw.unit, vars);
  const setter = gsap.quickSetter(target, property, unit);
  return {
    from: raw.value,
    ...(unit === undefined ? {} : { unit }),
    write(value: number): void {
      setter(value);
    },
  };
}

export function velocityFor(
  velocity: SpringTrackConfig['velocity'],
  property: SpringProperty,
): number {
  if (typeof velocity === 'number') return velocity;
  return velocity?.[property] ?? 0;
}

export function optionsFor(
  vars: SpringTrackConfig,
  property: SpringProperty,
): SpringParameters & { settle?: SpringSettleInput } {
  const propertyOptions = vars.properties?.[property];
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
export function springTo(target: gsap.TweenTarget, vars: SpringToVars): SpringController {
  const requestedTargets = requestedTargetsFrom(vars);

  if (Object.keys(requestedTargets).length === 0) {
    throw new TypeError('springTo requires at least one numeric target property');
  }

  const unsettledPolicy = vars.unsettled ?? 'stop';
  const clock = { elapsed: 0 };
  let active: Record<SpringProperty, ActiveProperty> = {};
  let tween: gsap.core.Tween;
  let duration = 0;
  let finiteDuration = 0;
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
      const inherited = activeTrackState(target, property);
      const resolvedRequest =
        requested.unit === undefined && inherited?.unit !== undefined
          ? { ...requested, unit: inherited.unit }
          : requested;
      const access = accessFor(target, property, resolvedRequest, vars);
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

    const entries = Object.values(next);
    return {
      entries: next,
      finiteDuration: Math.max(...entries.map((entry) => entry.duration), 0),
      logicalDuration: Math.max(
        ...entries.map((entry) => entry.spring.timing.perceptualDuration),
        0,
      ),
      hasUnsettled: entries.some((entry) => !entry.settling.settled),
      unsettledAt: Math.max(
        ...entries
          .filter((entry) => !entry.settling.settled)
          .map((entry) => entry.duration),
        0,
      ),
    };
  };

  const activate = (next: ActiveProperties): void => {
    if (unsettledPolicy === 'error' && next.hasUnsettled) {
      throw new RangeError('springTo cannot start an unsettled spring in error mode');
    }

    active = next.entries;
    finiteDuration = next.finiteDuration;
    hasUnsettled = next.hasUnsettled;
    duration =
      unsettledPolicy === 'continue' && hasUnsettled
        ? Number.POSITIVE_INFINITY
        : finiteDuration;
  };

  const stateFor = (entry: ActiveProperty, elapsed: number): SpringState => {
    if (entry.settling.settled && elapsed >= entry.duration) {
      return { position: entry.target, velocity: 0 };
    }
    if (!entry.settling.settled && elapsed >= entry.duration) {
      if (unsettledPolicy === 'snap') {
        return { position: entry.target, velocity: 0 };
      }
      if (unsettledPolicy === 'continue') return entry.spring.stateAt(elapsed);
      return entry.spring.stateAt(entry.duration);
    }
    return entry.spring.stateAt(elapsed);
  };

  const snapshotAt = (
    elapsed: number,
    entries: Readonly<Record<SpringProperty, ActiveProperty>> = active,
  ): SpringToSnapshot => {
    const states: Record<SpringProperty, SpringState> = {};
    for (const [property, entry] of Object.entries(entries)) {
      states[property] = stateFor(entry, elapsed);
    }
    return {
      elapsed: Number.isFinite(duration) ? Math.min(elapsed, duration) : elapsed,
      duration,
      states: states as SpringStateMap,
    };
  };

  const timingFor = (
    entries: Readonly<Record<SpringProperty, ActiveProperty>>,
  ): Omit<ActiveProperties, 'entries'> => {
    const values = Object.values(entries);
    return {
      finiteDuration: Math.max(...values.map((entry) => entry.duration), 0),
      logicalDuration: Math.max(
        ...values.map((entry) => entry.spring.timing.perceptualDuration),
        0,
      ),
      hasUnsettled: values.some((entry) => !entry.settling.settled),
      unsettledAt: Math.max(
        ...values
          .filter((entry) => !entry.settling.settled)
          .map((entry) => entry.duration),
        0,
      ),
    };
  };

  const notifyUnsettled = (
    snapshot: SpringToSnapshot,
    timing: Omit<ActiveProperties, 'entries'>,
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
    timing: Omit<ActiveProperties, 'entries'>,
  ): void => {
    if (killed) return;
    const resolvedLogicalDuration = timing.hasUnsettled
      ? timing.logicalDuration
      : Math.min(timing.logicalDuration, timing.finiteDuration);
    if (snapshot.elapsed < resolvedLogicalDuration) didLogicalComplete = false;
    if (snapshot.elapsed < timing.finiteDuration) didSettle = false;
    if (snapshot.elapsed < timing.unsettledAt) didNotifyUnsettled = false;

    if (!didLogicalComplete && snapshot.elapsed >= resolvedLogicalDuration) {
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

  const render = (): SpringToSnapshot => {
    const owners: Record<SpringProperty, ActiveProperty> = {};
    for (const [property, entry] of Object.entries(active)) {
      const registration = entry.registration;
      if (!registration) continue;
      if (
        clock.elapsed <= 0 &&
        entry.lastTime > 0 &&
        registration.isActive()
      ) {
        const restored = registration.release();
        entry.lastTime = clock.elapsed;
        if (!restored) entry.write(stateFor(entry, 0).position);
        continue;
      }
      if (clock.elapsed > 0 && !registration.isActive()) registration.activate();
      entry.lastTime = clock.elapsed;
      if (registration.isOwner()) owners[property] = entry;
    }

    const snapshot = snapshotAt(clock.elapsed, owners);
    for (const [property, entry] of Object.entries(owners)) {
      const state = snapshot.states[property];
      if (state) entry.write(state.position);
    }
    if (Object.keys(owners).length === 0) return snapshot;
    const timing = timingFor(owners);
    vars.onUpdate?.(snapshot);
    notifyTiming(snapshot, timing);
    notifyUnsettled(snapshot, timing);
    return snapshot;
  };

  const complete = (): void => {
    if (killed || didComplete) return;
    clock.elapsed = finiteDuration;
    const snapshot = render();
    if (Object.keys(snapshot.states).length === 0) return;
    didComplete = true;
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
        duration: finiteDuration,
        ease: 'none',
        onUpdate: render,
        onComplete: complete,
      }),
    );
  };

  activate(buildProperties(requestedTargets));
  for (const [property, entry] of Object.entries(active)) {
    entry.registration = registerActiveTrack(target, property, {
      state: (globalTime) => ({
        ...stateFor(
          entry,
          globalTime === undefined ? clock.elapsed : localTimeAt(tween, globalTime),
        ),
        ...(entry.unit === undefined ? {} : { unit: entry.unit }),
      }),
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
        Object.entries(active).map(([property, entry]) => [property, entry.spring]),
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
        throw new RangeError('seek time must be a finite number greater than or equal to 0');
      }
      const resolvedTime = Number.isFinite(duration) ? Math.min(time, duration) : time;
      if (Number.isFinite(duration)) tween.time(resolvedTime, false);
      else tween.totalTime(resolvedTime, false);
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
