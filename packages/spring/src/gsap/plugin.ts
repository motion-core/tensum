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
import { globalTimeAt, localTimeAt } from './gsap-time.js';
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
  UnsettledPolicy,
} from './spring-to.js';

export interface MotionSpringPluginVars {
  x?: SpringTargetValue;
  y?: SpringTargetValue;
  scale?: SpringTargetValue;
  rotation?: SpringTargetValue;
  values?: SpringTargets;
  parameters: SpringParameters & { settle?: SpringSettleInput };
  velocity?: number | SpringVelocities;
  properties?: Readonly<Record<SpringProperty, SpringPropertyOptions>>;
  adapters?: Readonly<Record<SpringProperty, SpringPropertyAdapter>>;
  units?: Readonly<Record<SpringProperty, string>>;
  unsettled?: UnsettledPolicy;
  onLogicalComplete?: (snapshot: SpringToSnapshot) => void;
  onSettle?: (snapshot: SpringToSnapshot) => void;
  onUnsettled?: (snapshot: SpringToSnapshot) => void;
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
}

interface TweenTimingState {
  duration: number;
  infinite: boolean;
}

const tweenTiming = new WeakMap<gsap.core.Tween, TweenTimingState>();
const GSAP_TIME_PRECISION = 1e7;

function gsapSafeDuration(duration: number): number {
  return Math.ceil(duration * GSAP_TIME_PRECISION) / GSAP_TIME_PRECISION;
}

function pluginTargetsFrom(vars: MotionSpringPluginVars): Record<string, RequestedTarget> {
  const requested: Record<string, RequestedTarget> = {};
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

function stateFor(
  track: PluginTrack,
  time: number,
  policy: UnsettledPolicy,
): SpringState {
  if (track.settling.settled && time >= track.duration) {
    return { position: track.target, velocity: 0 };
  }
  if (!track.settling.settled && time >= track.duration) {
    if (policy === 'snap') return { position: track.target, velocity: 0 };
    if (policy === 'continue') return track.spring.stateAt(time);
    return track.spring.stateAt(track.duration);
  }
  return track.spring.stateAt(time);
}

function currentTime(scope: MotionSpringPluginScope): number {
  return scope.policy === 'continue' && scope.hasUnsettled
    ? scope.tween.totalTime()
    : scope.tween.time();
}

function timingFor(
  tracks: readonly PluginTrack[],
  policy: UnsettledPolicy,
): {
  finiteDuration: number;
  hasUnsettled: boolean;
  logicalDuration: number;
  unsettledAt: number;
} {
  const finiteDuration = Math.max(...tracks.map((track) => track.duration), 0);
  const hasUnsettled = tracks.some((track) => !track.settling.settled);
  const requestedLogicalDuration = Math.max(
    ...tracks.map((track) => track.spring.timing.perceptualDuration),
    0,
  );
  return {
    finiteDuration,
    hasUnsettled,
    logicalDuration:
      policy === 'continue' && hasUnsettled
        ? requestedLogicalDuration
        : Math.min(requestedLogicalDuration, finiteDuration),
    unsettledAt: Math.max(
      ...tracks
        .filter((track) => !track.settling.settled)
        .map((track) => track.duration),
      0,
    ),
  };
}

function snapshotAt(
  scope: MotionSpringPluginScope,
  time: number,
  tracks: readonly PluginTrack[] = scope.tracks,
): SpringToSnapshot {
  const states: Record<string, SpringState> = {};
  for (const track of tracks) {
    states[track.property] = stateFor(track, time, scope.policy);
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
    if (time <= 0 && track.lastTime > 0 && registration.isActive()) {
      const restored = registration.release();
      track.lastTime = time;
      if (!restored) track.write(stateFor(track, 0, scope.policy).position);
      continue;
    }
    if (time > 0 && !registration.isActive()) registration.activate();
    track.lastTime = time;
    if (registration.isOwner()) owners.push(track);
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
}

function configureTweenDuration(
  tween: gsap.core.Tween,
  duration: number,
  infinite: boolean,
): void {
  const state = tweenTiming.get(tween) ?? { duration: 0, infinite: false };
  state.duration = Math.max(state.duration, duration);
  state.infinite ||= infinite;
  tweenTiming.set(tween, state);

  if (state.infinite) {
    tween.duration(1);
    tween.repeat(-1);
  } else {
    // GSAP stores time at seven decimal places. Rounding upward prevents its
    // completion boundary from landing microscopically before physical rest.
    tween.duration(gsapSafeDuration(state.duration));
  }
}

const pluginDefinition = {
  version: '0.1.0',
  name: 'motionSpring',
  headless: true,
  rawVars: 1,
  init(
    this: MotionSpringPluginScope,
    target: object,
    value: MotionSpringPluginVars,
    tween: gsap.core.Tween,
  ): boolean {
    if (!value || typeof value !== 'object') {
      throw new TypeError('motionSpring requires a configuration object');
    }
    const requested = pluginTargetsFrom(value);
    if (Object.keys(requested).length === 0) {
      throw new TypeError('motionSpring requires at least one numeric target property');
    }

    const config = trackConfigFrom(value);
    const handoffTime = globalTimeAt(tween, 0);
    const tracks: PluginTrack[] = [];
    for (const [property, destination] of Object.entries(requested)) {
      const inherited = activeTrackState(target, property, handoffTime);
      const resolvedDestination =
        destination.unit === undefined && inherited?.unit !== undefined
          ? { ...destination, unit: inherited.unit }
          : destination;
      const access = accessFor(target, property, resolvedDestination, config);
      if (
        inherited?.unit !== undefined &&
        access.unit !== undefined &&
        inherited.unit !== access.unit
      ) {
        throw new TypeError(
          `Unit mismatch for ${property}: expected ${inherited.unit}, received ${access.unit}`,
        );
      }
      const spring = createSpring({
        from: inherited?.position ?? access.from,
        to: destination.value,
        velocity:
          inherited?.velocity ??
          value.properties?.[property]?.velocity ??
          velocityFor(value.velocity, property),
        ...optionsFor(config, property),
      });
      const settling = spring.getSettlingResult();
      tracks.push({
        property,
        target: destination.value,
        ...(access.unit === undefined ? {} : { unit: access.unit }),
        duration: settling.duration,
        settling,
        spring,
        lastTime: 0,
        write: access.write,
      });
      this._props.push(property);
    }

    const hasUnsettled = tracks.some((track) => !track.settling.settled);
    const policy = value.unsettled ?? 'stop';
    if (policy === 'error' && hasUnsettled) {
      throw new RangeError('motionSpring cannot start an unsettled spring in error mode');
    }
    const finiteDuration = Math.max(...tracks.map((track) => track.duration), 0);
    const infinite = policy === 'continue' && hasUnsettled;
    const duration = infinite ? Number.POSITIVE_INFINITY : finiteDuration;
    const requestedLogicalDuration = Math.max(
      ...tracks.map((track) => track.spring.timing.perceptualDuration),
      0,
    );

    this.tracks = tracks;
    this.tween = tween;
    this.policy = policy;
    this.duration = duration;
    this.finiteDuration = finiteDuration;
    this.logicalDuration = infinite
      ? requestedLogicalDuration
      : Math.min(requestedLogicalDuration, finiteDuration);
    this.unsettledAt = Math.max(
      ...tracks
        .filter((track) => !track.settling.settled)
        .map((track) => track.duration),
      0,
    );
    this.hasUnsettled = hasUnsettled;
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
        state: (globalTime) => ({
          ...stateFor(
            track,
            globalTime === undefined
              ? currentTime(this)
              : localTimeAt(this.tween, globalTime),
            this.policy,
          ),
          ...(track.unit === undefined ? {} : { unit: track.unit }),
        }),
        restore: () => {
          track.write(stateFor(track, currentTime(this), this.policy).position);
        },
      });
    }
    const previousInterrupt = tween.eventCallback('onInterrupt');
    tween.eventCallback('onInterrupt', () => {
      for (const track of this.tracks) track.registration?.release();
      previousInterrupt?.apply(
        tween.vars.callbackScope ?? tween,
        tween.vars.onInterruptParams ?? [],
      );
    });

    configureTweenDuration(tween, finiteDuration, infinite);
    return true;
  },
  render(
    _ratio: number,
    data: gsap.PluginScope,
  ): void {
    const scope = data as MotionSpringPluginScope;
    renderAt(scope, currentTime(scope));
  },
  kill(this: MotionSpringPluginScope, property?: string): void {
    if (!property || property === 'motionSpring') {
      for (const track of this.tracks) track.registration?.release();
      this.killed = true;
      this.tracks.length = 0;
      return;
    }
    for (const track of this.tracks) {
      if (track.property === property) track.registration?.release();
    }
    this.tracks = this.tracks.filter((track) => track.property !== property);
    this._props = this._props.filter((tracked) => tracked !== property);
    if (this.tracks.length === 0) this.killed = true;
  },
};

export const MotionCoreSpringPlugin = pluginDefinition as unknown as gsap.Plugin;

export function registerMotionCoreSpringPlugin(
  instance: typeof gsap = gsap,
): void {
  instance.registerPlugin(MotionCoreSpringPlugin);
}

declare global {
  namespace gsap {
    interface TweenVars {
      motionSpring?: MotionSpringPluginVars;
    }
  }
}
