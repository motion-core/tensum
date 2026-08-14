import { createSpring } from '@motion-core/spring';
import type {
  SettlingResult,
  SpringParameters,
  SpringSettleInput,
  SpringSolution,
  SpringState,
} from '@motion-core/spring';
import { gsap } from 'gsap';
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
  duration: number;
  settling: SettlingResult;
  spring: SpringSolution;
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

function snapshotAt(
  scope: MotionSpringPluginScope,
  time: number,
): SpringToSnapshot {
  const states: Record<string, SpringState> = {};
  for (const track of scope.tracks) {
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
  const snapshot = snapshotAt(scope, time);
  for (const track of scope.tracks) {
    const state = snapshot.states[track.property];
    if (state) track.write(state.position);
  }

  if (time < scope.logicalDuration) scope.didLogicalComplete = false;
  if (time < scope.finiteDuration) scope.didSettle = false;
  if (time < scope.unsettledAt) scope.didNotifyUnsettled = false;

  if (!scope.didLogicalComplete && time >= scope.logicalDuration) {
    scope.didLogicalComplete = true;
    scope.callbacks.onLogicalComplete?.(snapshot);
  }
  if (
    !scope.hasUnsettled &&
    !scope.didSettle &&
    time >= scope.finiteDuration
  ) {
    scope.didSettle = true;
    scope.callbacks.onSettle?.(snapshot);
  }
  if (
    scope.hasUnsettled &&
    !scope.didNotifyUnsettled &&
    time >= scope.unsettledAt
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
    tween.duration(state.duration);
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
    const tracks: PluginTrack[] = [];
    for (const [property, destination] of Object.entries(requested)) {
      const access = accessFor(target, property, destination, config);
      const spring = createSpring({
        from: access.from,
        to: destination.value,
        velocity:
          value.properties?.[property]?.velocity ??
          velocityFor(value.velocity, property),
        ...optionsFor(config, property),
      });
      const settling = spring.getSettlingResult();
      tracks.push({
        property,
        target: destination.value,
        duration: settling.duration,
        settling,
        spring,
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

    configureTweenDuration(tween, finiteDuration, infinite);
    return true;
  },
  render(
    _ratio: number,
    data: gsap.PluginScope,
  ): void {
    const scope = data as MotionSpringPluginScope;
    const time =
      scope.policy === 'continue' && scope.hasUnsettled
        ? scope.tween.totalTime()
        : scope.tween.time();
    renderAt(scope, time);
  },
  kill(this: MotionSpringPluginScope, property?: string): void {
    if (!property || property === 'motionSpring') {
      this.killed = true;
      this.tracks.length = 0;
      return;
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
