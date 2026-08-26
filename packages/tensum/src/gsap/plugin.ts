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
import { currentLocalCycle, localCycleAt, localTimeAt } from './gsap-time.js';
import {
  beginPluginTweenInit,
  registerPluginTweenParticipant,
} from './plugin-tween-coordinator.js';
import type { PluginTweenRegistration } from './plugin-tween-coordinator.js';
import {
  gsapSafeDuration,
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
import {
  SUPPORTED_PROPERTIES,
  accessFor,
  optionsFor,
  parseNumericValue,
  velocityFor,
} from './spring-to.js';
import type {
  RequestedTarget,
  SpringProperty,
  SpringPropertyAdapter,
  SpringPropertyOptions,
  SpringStateMap,
  SpringTargetValue,
  SpringTargets,
  SpringToSnapshot,
  SpringTrackConfig,
  SpringVelocities,
} from './spring-to.js';

/** Spring configuration shared by the timeline effect and direct helper. */
export interface MotionSpringVars {
  x?: SpringTargetValue;
  y?: SpringTargetValue;
  scale?: SpringTargetValue;
  rotation?: SpringTargetValue;
  values?: SpringTargets;
  parameters: SpringParameters & { settle?: SpringSettleInput };
  velocity?: number | SpringVelocities;
  properties?: Readonly<Partial<Record<SpringProperty, SpringPropertyOptions>>>;
  adapters?: Readonly<Partial<Record<SpringProperty, SpringPropertyAdapter>>>;
  units?: Readonly<Partial<Record<SpringProperty, string>>>;
  /** Behavior when a track reaches `maxDuration` without settling. */
  unsettled?: UnsettledPolicy;
  /**
   * Runs once per target at each forward logical-completion crossing. The
   * snapshot does not include the target or its array index.
   */
  onLogicalComplete?: (snapshot: SpringToSnapshot) => void;
  /**
   * Runs once per settled target at each forward settlement crossing. The
   * snapshot does not include the target or its array index.
   */
  onSettle?: (snapshot: SpringToSnapshot) => void;
  /**
   * Runs once per unsettled target at each forward `maxDuration` crossing. The
   * snapshot does not include the target or its array index.
   */
  onUnsettled?: (snapshot: SpringToSnapshot) => void;
}

/**
 * GSAP options forwarded by the preflighted effect. Spring owns `duration` and
 * `ease`, so those keys are rejected here.
 */
export type MotionSpringEffectTweenVars = Omit<
  gsap.TweenVars,
  'duration' | 'ease'
> & {
  duration?: never;
  ease?: never;
};

/**
 * Configuration for the preflighted GSAP effect. The effect resolves its
 * driver duration before GSAP inserts the returned tween into a timeline.
 *
 * `from` snapshots an explicit future starting state. Supply it when building
 * a timeline whose target will be changed by an earlier child; without it,
 * preflight intentionally reads the target at effect-construction time.
 */
export interface MotionSpringEffectVars extends MotionSpringVars {
  /**
   * Explicit starting snapshot captured during effect construction. One map is
   * applied to every resolved target. Without it, preflight reads each target.
   */
  from?: SpringTargets;
  /** GSAP driver options such as `paused`, `stagger`, `repeat`, and `yoyo`. */
  tween?: MotionSpringEffectTweenVars;
}

interface PluginTrack {
  property: SpringProperty;
  target: number;
  unit?: string;
  duration: number;
  settling: SettlingResult;
  spring: SpringSolution;
  registration?: ActiveTrackRegistration;
  lastTime: number;
  write(value: number): void;
}

interface MotionSpringDriverScope extends gsap.PluginScope {
  tracks: PluginTrack[];
  tween: gsap.core.Tween;
  policy: UnsettledPolicy;
  duration: number;
  finiteDuration: number;
  logicalDuration: number;
  unsettledAt: number;
  hasUnsettled: boolean;
  killed: boolean;
  didLogicalComplete: boolean;
  didSettle: boolean;
  didNotifyUnsettled: boolean;
  callbacks: Pick<
    MotionSpringVars,
    'onLogicalComplete' | 'onSettle' | 'onUnsettled'
  >;
  coordinator?: PluginTweenRegistration;
}

interface PreparedTrack {
  target: number;
  unit?: string;
  duration: number;
  settling: SettlingResult;
  spring: SpringSolution;
  write(value: number): void;
}

interface PreparedTarget {
  tracks: Readonly<Record<SpringProperty, PreparedTrack>>;
}

interface PreparedMotionSpring {
  targets: WeakMap<object, PreparedTarget>;
  baseDuration: number;
  baseRepeat: number;
}

const preparedMotionSprings = new WeakMap<
  MotionSpringVars,
  PreparedMotionSpring
>();
const INTERNAL_DRIVER_PROPERTY = '__tensumSpringDriver';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateMapProperty(property: string): void {
  parseNumericValue(0, property);
}

function normalizeOptionalRecord(
  value: unknown,
  name: string,
): Record<string, unknown> | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) {
    throw new TypeError(`${name} must be an object when provided`);
  }
  return { ...value };
}

function normalizeTargets(
  value: unknown,
  name: string,
): SpringTargets | undefined {
  const record = normalizeOptionalRecord(value, name);
  if (!record) return undefined;
  for (const [property, target] of Object.entries(record)) {
    parseNumericValue(target, property);
  }
  return record as SpringTargets;
}

function normalizeProperties(value: unknown): MotionSpringVars['properties'] {
  const record = normalizeOptionalRecord(value, 'spring properties');
  if (!record) return undefined;
  const properties = Object.create(null) as Record<
    string,
    SpringPropertyOptions
  >;
  for (const [property, options] of Object.entries(record)) {
    validateMapProperty(property);
    if (!isRecord(options)) {
      throw new TypeError(`Properties for ${property} must be an object`);
    }
    const normalized = { ...options };
    for (const parameter of [
      'mass',
      'stiffness',
      'damping',
      'velocity',
    ] as const) {
      const parameterValue = normalized[parameter];
      if (
        parameterValue !== undefined &&
        (typeof parameterValue !== 'number' || !Number.isFinite(parameterValue))
      ) {
        throw new TypeError(
          `${parameter} for ${property} must be a finite number`,
        );
      }
    }
    if (normalized['settle'] !== undefined) {
      if (!isRecord(normalized['settle'])) {
        throw new TypeError(`settle for ${property} must be an object`);
      }
      normalized['settle'] = { ...normalized['settle'] };
    }
    properties[property] = normalized as SpringPropertyOptions;
  }
  return properties;
}

function normalizeAdapters(value: unknown): MotionSpringVars['adapters'] {
  const record = normalizeOptionalRecord(value, 'spring adapters');
  if (!record) return undefined;
  const adapters = Object.create(null) as Record<string, SpringPropertyAdapter>;
  for (const [property, adapter] of Object.entries(record)) {
    validateMapProperty(property);
    if (!isRecord(adapter)) {
      throw new TypeError(`Adapter for ${property} must be an object`);
    }
    if (
      typeof adapter['read'] !== 'function' ||
      typeof adapter['write'] !== 'function'
    ) {
      throw new TypeError(
        `Adapter for ${property} must provide read and write functions`,
      );
    }
    if (adapter['unit'] !== undefined && typeof adapter['unit'] !== 'string') {
      throw new TypeError(`Adapter unit for ${property} must be a string`);
    }
    adapters[property] = adapter as unknown as SpringPropertyAdapter;
  }
  return adapters;
}

function normalizeUnits(value: unknown): MotionSpringVars['units'] {
  const record = normalizeOptionalRecord(value, 'spring units');
  if (!record) return undefined;
  const units = Object.create(null) as Record<string, string>;
  for (const [property, unit] of Object.entries(record)) {
    validateMapProperty(property);
    if (typeof unit !== 'string') {
      throw new TypeError(`Unit for ${property} must be a string`);
    }
    units[property] = unit;
  }
  return units;
}

function normalizeVelocity(value: unknown): MotionSpringVars['velocity'] {
  if (value === undefined) return undefined;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError('spring velocity must be a finite number');
    }
    return value;
  }
  const record = normalizeOptionalRecord(value, 'spring velocity')!;
  const velocities = Object.create(null) as Record<string, number>;
  for (const [property, velocity] of Object.entries(record)) {
    validateMapProperty(property);
    if (typeof velocity !== 'number' || !Number.isFinite(velocity)) {
      throw new TypeError(`Velocity for ${property} must be a finite number`);
    }
    velocities[property] = velocity;
  }
  return velocities;
}

function normalizeMotionSpringVars(
  value: unknown,
  context = 'spring',
): MotionSpringVars {
  if (!isRecord(value)) {
    throw new TypeError(`${context} requires a configuration object`);
  }
  const own = { ...value };
  if (!isRecord(own['parameters'])) {
    throw new TypeError(`${context} requires a parameters object`);
  }
  const parameters = { ...own['parameters'] };
  if (parameters['settle'] !== undefined) {
    if (!isRecord(parameters['settle'])) {
      throw new TypeError(`${context} parameters.settle must be an object`);
    }
    parameters['settle'] = { ...parameters['settle'] };
  }

  const normalized = {
    ...own,
    parameters,
    values: normalizeTargets(own['values'], `${context} values`),
    properties: normalizeProperties(own['properties']),
    adapters: normalizeAdapters(own['adapters']),
    units: normalizeUnits(own['units']),
    velocity: normalizeVelocity(own['velocity']),
  } as unknown as MotionSpringVars;

  for (const callback of [
    'onLogicalComplete',
    'onSettle',
    'onUnsettled',
  ] as const) {
    const callbackValue = normalized[callback];
    if (callbackValue !== undefined && typeof callbackValue !== 'function') {
      throw new TypeError(`${context} ${callback} must be a function`);
    }
  }
  if (normalized.unsettled !== undefined) {
    validateUnsettledPolicy(normalized.unsettled, `${context} unsettled`);
  }
  return normalized;
}

function pluginTargetsFrom(
  vars: MotionSpringVars,
): Record<string, RequestedTarget> {
  const requested = Object.create(null) as Record<string, RequestedTarget>;
  for (const property of SUPPORTED_PROPERTIES) {
    const value = Object.hasOwn(vars, property) ? vars[property] : undefined;
    if (value !== undefined)
      requested[property] = parseNumericValue(value, property);
  }
  for (const [property, value] of Object.entries(vars.values ?? {})) {
    requested[property] = parseNumericValue(value, property);
  }
  return requested;
}

function trackConfigFrom(vars: MotionSpringVars): SpringTrackConfig {
  return {
    spring: vars.parameters,
    ...(vars.velocity === undefined ? {} : { velocity: vars.velocity }),
    ...(vars.properties === undefined ? {} : { properties: vars.properties }),
    ...(vars.adapters === undefined ? {} : { adapters: vars.adapters }),
    ...(vars.units === undefined ? {} : { units: vars.units }),
  };
}

function explicitStateFrom(
  from: SpringTargets | undefined,
  property: SpringProperty,
): RequestedTarget | undefined {
  const value =
    from && Object.hasOwn(from, property) ? from[property] : undefined;
  return value === undefined ? undefined : parseNumericValue(value, property);
}

function preflightTarget(
  target: object,
  vars: MotionSpringVars,
  from: SpringTargets | undefined,
): PreparedTarget {
  const requested = pluginTargetsFrom(vars);
  if (Object.keys(requested).length === 0) {
    throw new TypeError('spring requires at least one numeric target property');
  }

  const config = trackConfigFrom(vars);
  const tracks = Object.create(null) as Record<SpringProperty, PreparedTrack>;
  for (const [property, destination] of Object.entries(requested)) {
    const explicit = explicitStateFrom(from, property);
    let inherited =
      explicit === undefined ? activeTrackState(target, property) : undefined;
    const initialUnit =
      explicit?.unit ?? (inherited?.terminal ? undefined : inherited?.unit);
    const resolvedDestination =
      destination.unit === undefined && initialUnit !== undefined
        ? { ...destination, unit: initialUnit }
        : destination;
    const access = accessFor(target, property, resolvedDestination, config);
    if (explicit === undefined) {
      inherited = reconcileActiveTrackHandoff(
        target,
        property,
        inherited,
        access.from,
        access.unit,
      );
    }
    const handoffUnit = explicit?.unit ?? inherited?.unit;
    if (
      handoffUnit !== undefined &&
      access.unit !== undefined &&
      handoffUnit !== access.unit
    ) {
      throw new TypeError(
        `Unit mismatch for ${property}: expected ${handoffUnit}, received ${access.unit}`,
      );
    }
    const spring = createSpring({
      from: explicit?.value ?? inherited?.position ?? access.from,
      to: destination.value,
      velocity:
        inherited?.velocity ??
        config.properties?.[property]?.velocity ??
        velocityFor(config.velocity, property),
      ...optionsFor(config, property),
    });
    const settling = spring.getSettlingResult();
    tracks[property] = {
      target: destination.value,
      ...(access.unit === undefined ? {} : { unit: access.unit }),
      duration: settling.duration,
      settling,
      spring,
      write: access.write,
    };
  }
  return { tracks };
}

/**
 * Creates a preflighted GSAP tween whose duration is final before it is added
 * to a timeline. Prefer the registered `timeline.spring()` effect for
 * sequential, staggered, or nested composition. Calling `invalidate()` reuses
 * the prepared snapshot; create a new effect tween to preflight changed
 * starting values, destinations, or parameters.
 */
export function createMotionSpringTween(
  targets: gsap.TweenTarget,
  rawVars: MotionSpringEffectVars,
  instance: typeof gsap = gsap,
): gsap.core.Tween {
  if (!isRecord(rawVars)) {
    throw new TypeError('spring effect requires a configuration object');
  }
  const resolvedTargets = instance.utils.toArray<object>(targets);
  if (resolvedTargets.length === 0) {
    throw new TypeError('spring effect requires at least one target');
  }

  const ownVars = { ...rawVars } as Record<string, unknown>;
  const from = normalizeTargets(ownVars['from'], 'spring effect from');
  const tweenOptions = normalizeOptionalRecord(
    ownVars['tween'],
    'spring effect tween',
  ) as MotionSpringEffectTweenVars | undefined;
  delete ownVars['from'];
  delete ownVars['tween'];
  const pluginVars = normalizeMotionSpringVars(ownVars, 'spring effect');
  const preparedTargets = new WeakMap<object, PreparedTarget>();
  let finiteDuration = 0;
  let hasUnsettled = false;
  for (const target of resolvedTargets) {
    const prepared = preflightTarget(target, pluginVars, from);
    preparedTargets.set(target, prepared);
    for (const track of Object.values(prepared.tracks)) {
      finiteDuration = Math.max(finiteDuration, track.duration);
      hasUnsettled ||= !track.settling.settled;
    }
  }

  const policy = validateUnsettledPolicy(
    pluginVars.unsettled ?? 'stop',
    'spring unsettled',
  );
  if (policy === 'error' && hasUnsettled) {
    throw new RangeError(
      'spring cannot start an unsettled spring in error mode',
    );
  }
  const infinite = policy === 'continue' && hasUnsettled;
  preparedMotionSprings.set(pluginVars, {
    targets: preparedTargets,
    baseDuration: gsapSafeDuration(finiteDuration),
    baseRepeat:
      typeof tweenOptions?.['repeat'] === 'number' ? tweenOptions['repeat'] : 0,
  });

  const safeTweenOptions = { ...(tweenOptions ?? {}) } as gsap.TweenVars;
  delete safeTweenOptions.duration;
  delete safeTweenOptions.ease;
  delete safeTweenOptions[INTERNAL_DRIVER_PROPERTY];
  if (infinite) safeTweenOptions.repeat = -1;

  return instance.to(resolvedTargets, {
    ...safeTweenOptions,
    duration: infinite ? 1 : gsapSafeDuration(finiteDuration),
    ease: 'none',
    [INTERNAL_DRIVER_PROPERTY]: pluginVars,
  } as gsap.TweenVars);
}

function currentTime(scope: MotionSpringDriverScope): number {
  return scope.policy === 'continue' && scope.hasUnsettled
    ? scope.tween.totalTime()
    : scope.tween.time();
}

function timingFor(
  tracks: readonly PluginTrack[],
  policy: UnsettledPolicy,
): SpringTrackTiming {
  return springTrackTiming(tracks, policy);
}

function updateScopeTiming(scope: MotionSpringDriverScope): void {
  const timing = timingFor(scope.tracks, scope.policy);
  scope.finiteDuration = timing.finiteDuration;
  scope.hasUnsettled = timing.hasUnsettled;
  scope.duration =
    scope.policy === 'continue' && timing.hasUnsettled
      ? Number.POSITIVE_INFINITY
      : timing.finiteDuration;
  scope.logicalDuration = timing.logicalDuration;
  scope.unsettledAt = timing.unsettledAt;
}

function snapshotAt(
  scope: MotionSpringDriverScope,
  time: number,
  tracks: readonly PluginTrack[] = scope.tracks,
): SpringToSnapshot {
  const states: Record<string, SpringState> = {};
  for (const track of tracks) {
    states[track.property] = springTrackState(track, time, scope.policy);
  }
  return {
    elapsed: Number.isFinite(scope.duration)
      ? Math.min(time, scope.duration)
      : time,
    duration: scope.duration,
    states: states as SpringStateMap,
  };
}

function renderAt(scope: MotionSpringDriverScope, time: number): void {
  if (scope.killed) return;
  const owners: PluginTrack[] = [];
  const retainAtCompletedYoyoStart =
    scope.tween.repeat() > 0 &&
    scope.tween.yoyo() &&
    scope.tween.repeat() % 2 === 1 &&
    scope.tween.totalTime() >= scope.tween.totalDuration();
  for (const track of scope.tracks) {
    const registration = track.registration;
    if (!registration) continue;
    const transition = syncActiveTrackRegistration(
      registration,
      time,
      track.lastTime,
      { retainAtStart: retainAtCompletedYoyoStart },
    );
    track.lastTime = time;
    if (transition.releasedAtStart) {
      if (!transition.restoredPrevious) {
        track.write(springTrackState(track, 0, scope.policy).position);
      }
      continue;
    }
    if (transition.isOwner) owners.push(track);
  }
  if (owners.length === 0) return;

  const snapshot = snapshotAt(scope, time, owners);
  for (const track of owners) {
    const state = snapshot.states[track.property];
    if (state) track.write(state.position);
  }

  const timing = timingFor(owners, scope.policy);

  if (time < timing.logicalDuration) scope.didLogicalComplete = false;
  if (time < timing.finiteDuration) scope.didSettle = false;
  if (time < timing.unsettledAt) scope.didNotifyUnsettled = false;

  if (!scope.didLogicalComplete && time >= timing.logicalDuration) {
    scope.didLogicalComplete = true;
    scope.callbacks.onLogicalComplete?.(snapshot);
    if (scope.killed || !scope.tween.parent) return;
  }
  if (
    !timing.hasUnsettled &&
    !scope.didSettle &&
    time >= timing.finiteDuration
  ) {
    scope.didSettle = true;
    scope.callbacks.onSettle?.(snapshot);
    if (scope.killed || !scope.tween.parent) return;
  }
  if (
    timing.hasUnsettled &&
    !scope.didNotifyUnsettled &&
    time >= timing.unsettledAt
  ) {
    scope.didNotifyUnsettled = true;
    scope.callbacks.onUnsettled?.(snapshot);
    if (scope.killed || !scope.tween.parent) return;
  }

  if (
    scope.tween.repeat() >= 0 &&
    scope.tween.totalTime() >= scope.tween.totalDuration()
  ) {
    retireActiveTrackRegistrations(
      scope.tracks.map((track) => track.registration),
    );
  }
}

function registerSpringEffect(instance: typeof gsap): void {
  instance.registerEffect({
    name: 'spring',
    extendTimeline: true,
    effect(targets: object[], vars: MotionSpringEffectVars): gsap.core.Tween {
      return createMotionSpringTween(targets, vars, instance);
    },
  });
}

const pluginDefinition = {
  version: '0.2.0',
  name: INTERNAL_DRIVER_PROPERTY,
  headless: true,
  rawVars: 1,
  register(instance: typeof gsap): void {
    registerSpringEffect(instance);
  },
  init(
    this: MotionSpringDriverScope,
    target: object,
    rawValue: MotionSpringVars,
    tween: gsap.core.Tween,
    _targetIndex: number,
  ): boolean {
    const prepared = isRecord(rawValue)
      ? preparedMotionSprings.get(rawValue as MotionSpringVars)
      : undefined;
    if (!prepared) {
      throw new TypeError(
        'The Tensum GSAP driver is internal; use timeline.spring() or createMotionSpringTween()',
      );
    }
    const value = rawValue;
    const requested = pluginTargetsFrom(value);
    if (Object.keys(requested).length === 0) {
      throw new TypeError(
        'spring requires at least one numeric target property',
      );
    }
    const coordinator = beginPluginTweenInit(tween, target, {
      baseDuration: prepared.baseDuration,
      baseRepeat: prepared.baseRepeat,
    });
    const preparedTarget = prepared.targets.get(target);
    if (!preparedTarget) {
      throw new TypeError(
        'The preflighted spring target is unavailable; create a new effect tween',
      );
    }
    if (
      Object.keys(preparedTarget.tracks).length !==
        Object.keys(requested).length ||
      Object.keys(requested).some(
        (property) => preparedTarget.tracks[property] === undefined,
      )
    ) {
      throw new TypeError(
        'A preflighted spring configuration cannot change before init; create a new effect tween instead',
      );
    }
    const tracks: PluginTrack[] = [];
    for (const [property, destination] of Object.entries(requested)) {
      const preparedTrack = preparedTarget.tracks[property]!;
      if (
        destination.value !== preparedTrack.target ||
        (destination.unit !== undefined &&
          destination.unit !== preparedTrack.unit)
      ) {
        throw new TypeError(
          'A preflighted spring configuration cannot change before init; create a new effect tween instead',
        );
      }
      tracks.push({
        property,
        target: preparedTrack.target,
        ...(preparedTrack.unit === undefined
          ? {}
          : { unit: preparedTrack.unit }),
        duration: preparedTrack.duration,
        settling: preparedTrack.settling,
        spring: preparedTrack.spring,
        lastTime: 0,
        write: preparedTrack.write,
      });
      this._props.push(property);
    }

    const policy = validateUnsettledPolicy(
      value.unsettled ?? 'stop',
      'spring unsettled',
    );
    const timing = timingFor(tracks, policy);
    if (policy === 'error' && timing.hasUnsettled) {
      throw new RangeError(
        'spring cannot start an unsettled spring in error mode',
      );
    }
    const infinite = policy === 'continue' && timing.hasUnsettled;

    this.tracks = tracks;
    this.tween = tween;
    this.policy = policy;
    this.duration = infinite ? Number.POSITIVE_INFINITY : timing.finiteDuration;
    this.finiteDuration = timing.finiteDuration;
    this.logicalDuration = timing.logicalDuration;
    this.unsettledAt = timing.unsettledAt;
    this.hasUnsettled = timing.hasUnsettled;
    this.killed = false;
    this.didLogicalComplete = false;
    this.didSettle = false;
    this.didNotifyUnsettled = false;
    this.callbacks = {
      ...(value.onLogicalComplete === undefined
        ? {}
        : { onLogicalComplete: value.onLogicalComplete }),
      ...(value.onSettle === undefined ? {} : { onSettle: value.onSettle }),
      ...(value.onUnsettled === undefined
        ? {}
        : { onUnsettled: value.onUnsettled }),
    };

    for (const track of tracks) {
      track.registration = registerActiveTrack(target, track.property, {
        state: (globalTime) => {
          let time = currentTime(this);
          let direction: 1 | 0 | -1 = 1;
          if (this.policy === 'continue' && this.hasUnsettled) {
            direction = this.tween.reversed() ? -1 : 1;
            if (globalTime !== undefined) {
              time = localTimeAt(this.tween, globalTime);
            }
          } else {
            const cycle =
              globalTime === undefined
                ? currentLocalCycle(this.tween)
                : localCycleAt(this.tween, globalTime);
            time = cycle.time;
            direction = cycle.direction;
          }
          const state = springTrackState(track, time, this.policy);
          return {
            ...state,
            velocity: state.velocity * direction,
            ...(track.unit === undefined ? {} : { unit: track.unit }),
          };
        },
        restore: () => {
          track.write(
            springTrackState(track, currentTime(this), this.policy).position,
          );
        },
      });
    }
    this.coordinator = registerPluginTweenParticipant(coordinator, {
      timing: () => ({
        finiteDuration: timingFor(this.tracks, this.policy).finiteDuration,
        infinite:
          this.policy === 'continue' &&
          this.tracks.some((track) => !track.settling.settled),
      }),
      dispose: () => {
        for (const track of this.tracks) track.registration?.release();
        this.killed = true;
        this.tracks.length = 0;
      },
    });
    return true;
  },
  render(_ratio: number, data: gsap.PluginScope): void {
    const scope = data as MotionSpringDriverScope;
    renderAt(scope, currentTime(scope));
  },
  kill(this: MotionSpringDriverScope, property?: string): boolean {
    if (!property || property === INTERNAL_DRIVER_PROPERTY) {
      for (const track of this.tracks) track.registration?.release();
      this.killed = true;
      this.tracks.length = 0;
      this.coordinator?.remove();
      return true;
    }
    for (const track of this.tracks) {
      if (track.property === property) track.registration?.release();
    }
    this.tracks = this.tracks.filter((track) => track.property !== property);
    this._props = this._props.filter((tracked) => tracked !== property);
    updateScopeTiming(this);
    if (this.tracks.length === 0) {
      this.killed = true;
      this.coordinator?.remove();
      return true;
    }
    this.coordinator?.recompute();
    return false;
  },
};

/**
 * Tensum's GSAP plugin. Register it with `gsap.registerPlugin(TensumPlugin)`
 * before using the preflighted `timeline.spring()` effect.
 */
export const TensumPlugin = pluginDefinition as unknown as gsap.Plugin;

declare global {
  namespace gsap {
    interface EffectsMap {
      spring(targets: TweenTarget, vars: MotionSpringEffectVars): core.Tween;
    }

    namespace core {
      interface Timeline {
        spring(
          targets: TweenTarget,
          vars: MotionSpringEffectVars,
          position?: Position,
        ): this;
      }
    }
  }
}
