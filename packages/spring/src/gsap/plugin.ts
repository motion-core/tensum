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
import { globalTimeAt, localCycleAt, localTimeAt } from './gsap-time.js';
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

/** Configuration for the lazy `motionSpring` GSAP special property. */
export interface MotionSpringPluginVars {
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
 * GSAP options forwarded by the preflighted effect. Spring owns `duration`,
 * `ease`, and `motionSpring`, so those keys are rejected here.
 */
export type MotionSpringEffectTweenVars = Omit<
  gsap.TweenVars,
  'duration' | 'ease' | 'motionSpring'
> & {
  duration?: never;
  ease?: never;
  motionSpring?: never;
};

/**
 * Configuration for the preflighted GSAP effect. Unlike the lazy special
 * property, the effect resolves its driver duration before GSAP inserts the
 * returned tween into a timeline.
 *
 * `from` snapshots an explicit future starting state. Supply it when building
 * a timeline whose target will be changed by an earlier child; without it,
 * preflight intentionally reads the target at effect-construction time.
 */
export interface MotionSpringEffectVars extends MotionSpringPluginVars {
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

interface MotionSpringPluginScope extends gsap.PluginScope {
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
    MotionSpringPluginVars,
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
  MotionSpringPluginVars,
  PreparedMotionSpring
>();

function pluginTargetsFrom(vars: MotionSpringPluginVars): Record<string, RequestedTarget> {
  const requested = Object.create(null) as Record<string, RequestedTarget>;
  for (const property of SUPPORTED_PROPERTIES) {
    const value = vars[property];
    if (value !== undefined) requested[property] = parseNumericValue(value, property);
  }
  for (const [property, value] of Object.entries(vars.values ?? {})) {
    requested[property] = parseNumericValue(value, property);
  }
  return requested;
}

function trackConfigFrom(vars: MotionSpringPluginVars): SpringTrackConfig {
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
  const value = from?.[property];
  return value === undefined ? undefined : parseNumericValue(value, property);
}

function preflightTarget(
  target: object,
  vars: MotionSpringPluginVars,
  from: SpringTargets | undefined,
): PreparedTarget {
  const requested = pluginTargetsFrom(vars);
  if (Object.keys(requested).length === 0) {
    throw new TypeError('motionSpring requires at least one numeric target property');
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
        vars.properties?.[property]?.velocity ??
        velocityFor(vars.velocity, property),
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
 * to a timeline. Prefer the registered `timeline.motionSpring()` effect for
 * sequential, staggered, or nested composition. The raw `motionSpring` special
 * property remains available for direct tweens, but its lazy `init()` cannot
 * retroactively repair positions that a timeline has already resolved.
 * Calling `invalidate()` reuses the prepared snapshot; create a new effect
 * tween to preflight changed starting values, destinations, or parameters.
 */
export function createMotionSpringTween(
  targets: gsap.TweenTarget,
  vars: MotionSpringEffectVars,
  instance: typeof gsap = gsap,
): gsap.core.Tween {
  if (!vars || typeof vars !== 'object') {
    throw new TypeError('motionSpring effect requires a configuration object');
  }
  const resolvedTargets = instance.utils.toArray<object>(targets);
  if (resolvedTargets.length === 0) {
    throw new TypeError('motionSpring effect requires at least one target');
  }

  const { from, tween: tweenOptions, ...pluginVars } = vars;
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
    'motionSpring unsettled',
  );
  if (policy === 'error' && hasUnsettled) {
    throw new RangeError('motionSpring cannot start an unsettled spring in error mode');
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
  delete safeTweenOptions.motionSpring;
  if (infinite) safeTweenOptions.repeat = -1;

  return instance.to(resolvedTargets, {
    ...safeTweenOptions,
    duration: infinite ? 1 : gsapSafeDuration(finiteDuration),
    ease: 'none',
    motionSpring: pluginVars,
  });
}

function currentTime(scope: MotionSpringPluginScope): number {
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

function updateScopeTiming(scope: MotionSpringPluginScope): void {
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
  scope: MotionSpringPluginScope,
  time: number,
  tracks: readonly PluginTrack[] = scope.tracks,
): SpringToSnapshot {
  const states: Record<string, SpringState> = {};
  for (const track of tracks) {
    states[track.property] = springTrackState(track, time, scope.policy);
  }
  return {
    elapsed: Number.isFinite(scope.duration) ? Math.min(time, scope.duration) : time,
    duration: scope.duration,
    states: states as SpringStateMap,
  };
}

function renderAt(scope: MotionSpringPluginScope, time: number): void {
  if (scope.killed) return;
  const owners: PluginTrack[] = [];
  for (const track of scope.tracks) {
    const registration = track.registration;
    if (!registration) continue;
    const transition = syncActiveTrackRegistration(
      registration,
      time,
      track.lastTime,
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
  }
  if (
    !timing.hasUnsettled &&
    !scope.didSettle &&
    time >= timing.finiteDuration
  ) {
    scope.didSettle = true;
    scope.callbacks.onSettle?.(snapshot);
  }
  if (
    timing.hasUnsettled &&
    !scope.didNotifyUnsettled &&
    time >= timing.unsettledAt
  ) {
    scope.didNotifyUnsettled = true;
    scope.callbacks.onUnsettled?.(snapshot);
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

function registerMotionSpringEffect(instance: typeof gsap): void {
  instance.registerEffect({
    name: 'motionSpring',
    plugins: 'motionSpring',
    extendTimeline: true,
    effect(targets: object[], vars: MotionSpringEffectVars): gsap.core.Tween {
      return createMotionSpringTween(targets, vars, instance);
    },
  });
}

const pluginDefinition = {
  version: '0.1.0',
  name: 'motionSpring',
  headless: true,
  rawVars: 1,
  register(instance: typeof gsap): void {
    registerMotionSpringEffect(instance);
  },
  init(
    this: MotionSpringPluginScope,
    target: object,
    value: MotionSpringPluginVars,
    tween: gsap.core.Tween,
    _targetIndex: number,
  ): boolean {
    if (!value || typeof value !== 'object') {
      throw new TypeError('motionSpring requires a configuration object');
    }
    const requested = pluginTargetsFrom(value);
    if (Object.keys(requested).length === 0) {
      throw new TypeError('motionSpring requires at least one numeric target property');
    }

    const config = trackConfigFrom(value);
    const prepared = preparedMotionSprings.get(value);
    const coordinator = beginPluginTweenInit(tween, target, {
      baseDuration:
        prepared?.baseDuration ??
        (typeof tween.vars.duration === 'number'
          ? tween.vars.duration
          : tween.duration()),
      baseRepeat:
        prepared?.baseRepeat ??
        (typeof tween.vars.repeat === 'number' ? tween.vars.repeat : 0),
    });
    const preparedTarget = prepared?.targets.get(target);
    if (
      preparedTarget !== undefined &&
      (Object.keys(preparedTarget.tracks).length !== Object.keys(requested).length ||
        Object.keys(requested).some(
          (property) => preparedTarget.tracks[property] === undefined,
        ))
    ) {
      throw new TypeError(
        'A preflighted motionSpring configuration cannot change before init; create a new effect tween instead',
      );
    }
    const handoffTime = globalTimeAt(tween, 0);
    const tracks: PluginTrack[] = [];
    for (const [property, destination] of Object.entries(requested)) {
      const prepared = preparedTarget?.tracks[property];
      let inherited =
        prepared === undefined
          ? activeTrackState(target, property, handoffTime)
          : undefined;
      const inheritedUnit =
        prepared?.unit ?? (inherited?.terminal ? undefined : inherited?.unit);
      if (
        prepared !== undefined &&
        (destination.value !== prepared.target ||
          (destination.unit !== undefined && destination.unit !== prepared.unit))
      ) {
        throw new TypeError(
          'A preflighted motionSpring configuration cannot change before init; create a new effect tween instead',
        );
      }
      const access = prepared
        ? {
            from: prepared.spring.positionAt(0),
            ...(prepared.unit === undefined ? {} : { unit: prepared.unit }),
            write: prepared.write,
          }
        : accessFor(
            target,
            property,
            destination.unit === undefined && inheritedUnit !== undefined
              ? { ...destination, unit: inheritedUnit }
              : destination,
            config,
          );
      if (prepared === undefined) {
        inherited = reconcileActiveTrackHandoff(
          target,
          property,
          inherited,
          access.from,
          access.unit,
        );
      }
      const handoffUnit = prepared?.unit ?? inherited?.unit;
      if (
        prepared === undefined &&
        handoffUnit !== undefined &&
        access.unit !== undefined &&
        handoffUnit !== access.unit
      ) {
        throw new TypeError(
          `Unit mismatch for ${property}: expected ${handoffUnit}, received ${access.unit}`,
        );
      }
      const spring =
        prepared?.spring ??
        createSpring({
          from: inherited?.position ?? access.from,
          to: destination.value,
          velocity:
            inherited?.velocity ??
            value.properties?.[property]?.velocity ??
            velocityFor(value.velocity, property),
          ...optionsFor(config, property),
        });
      const settling = prepared?.settling ?? spring.getSettlingResult();
      tracks.push({
        property,
        target: prepared?.target ?? destination.value,
        ...(access.unit === undefined ? {} : { unit: access.unit }),
        duration: settling.duration,
        settling,
        spring,
        lastTime: 0,
        write: access.write,
      });
      this._props.push(property);
    }

    const policy = validateUnsettledPolicy(
      value.unsettled ?? 'stop',
      'motionSpring unsettled',
    );
    const timing = timingFor(tracks, policy);
    if (policy === 'error' && timing.hasUnsettled) {
      throw new RangeError('motionSpring cannot start an unsettled spring in error mode');
    }
    const infinite = policy === 'continue' && timing.hasUnsettled;

    this.tracks = tracks;
    this.tween = tween;
    this.policy = policy;
    this.duration = infinite
      ? Number.POSITIVE_INFINITY
      : timing.finiteDuration;
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
          if (globalTime !== undefined) {
            if (this.policy === 'continue' && this.hasUnsettled) {
              time = localTimeAt(this.tween, globalTime);
            } else {
              const cycle = localCycleAt(this.tween, globalTime);
              time = cycle.time;
              direction = cycle.direction;
            }
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
  render(
    _ratio: number,
    data: gsap.PluginScope,
  ): void {
    const scope = data as MotionSpringPluginScope;
    renderAt(scope, currentTime(scope));
  },
  kill(this: MotionSpringPluginScope, property?: string): boolean {
    if (!property || property === 'motionSpring') {
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

export const MotionCoreSpringPlugin = pluginDefinition as unknown as gsap.Plugin;

/** Registers both the special property and `timeline.motionSpring()` effect. */
export function registerMotionCoreSpringPlugin(
  instance: typeof gsap = gsap,
): void {
  instance.registerPlugin(MotionCoreSpringPlugin);
}

declare global {
  namespace gsap {
    interface EffectsMap {
      motionSpring(
        targets: TweenTarget,
        vars: MotionSpringEffectVars,
      ): core.Tween;
    }

    interface TweenVars {
      motionSpring?: MotionSpringPluginVars;
    }

    namespace core {
      interface Timeline {
        motionSpring(
          targets: TweenTarget,
          vars: MotionSpringEffectVars,
          position?: Position,
        ): this;
      }
    }
  }
}
