import { createSpring } from '@motion-core/spring';
import type {
  SettlingResult,
  SpringParameters,
  SpringSettleInput,
  SpringSolution,
  SpringState,
} from '@motion-core/spring';
import { gsap } from 'gsap';

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
  onUnsettled?: (snapshot: SpringToSnapshot) => void;
  onComplete?: () => void;
}

export interface SpringController {
  readonly duration: number;
  readonly springs: SpringSolutionMap;
  readonly tween: gsap.core.Tween;
  getSnapshot(): SpringToSnapshot;
  retarget(targets: SpringTargets): void;
  kill(): void;
}

interface ActiveProperty {
  target: number;
  unit?: string;
  duration: number;
  settling: SettlingResult;
  spring: SpringSolution;
  write: (value: number) => void;
}

interface ActiveProperties {
  entries: Record<SpringProperty, ActiveProperty>;
  finiteDuration: number;
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
  let unsettledAt = 0;
  let didComplete = false;
  let didNotifyUnsettled = false;
  let killed = false;

  const buildProperties = (
    targets: RequestedTargets,
    inherited?: Readonly<Record<SpringProperty, SpringState>>,
  ): ActiveProperties => {
    const next: Record<SpringProperty, ActiveProperty> = {};

    for (const [property, requested] of Object.entries(targets)) {
      const to = requested.value;
      const access = accessFor(target, property, requested, vars);
      const from = inherited?.[property]?.position ?? access.from;
      const velocity =
        inherited?.[property]?.velocity ??
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
        write: access.write,
      };
    }

    const entries = Object.values(next);
    return {
      entries: next,
      finiteDuration: Math.max(...entries.map((entry) => entry.duration), 0),
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
    unsettledAt = next.unsettledAt;
    duration =
      unsettledPolicy === 'continue' && hasUnsettled
        ? Number.POSITIVE_INFINITY
        : finiteDuration;
  };

  const snapshotAt = (elapsed: number): SpringToSnapshot => {
    const states: Record<SpringProperty, SpringState> = {};
    for (const [property, entry] of Object.entries(active)) {
      if (entry.settling.settled && elapsed >= entry.duration) {
        states[property] = { position: entry.target, velocity: 0 };
      } else if (!entry.settling.settled && elapsed >= entry.duration) {
        if (unsettledPolicy === 'snap') {
          states[property] = { position: entry.target, velocity: 0 };
        } else if (unsettledPolicy === 'continue') {
          states[property] = entry.spring.stateAt(elapsed);
        } else {
          states[property] = entry.spring.stateAt(entry.duration);
        }
      } else {
        states[property] = entry.spring.stateAt(elapsed);
      }
    }
    return {
      elapsed: Number.isFinite(duration) ? Math.min(elapsed, duration) : elapsed,
      duration,
      states: states as SpringStateMap,
    };
  };

  const notifyUnsettled = (snapshot: SpringToSnapshot): void => {
    if (
      killed ||
      didNotifyUnsettled ||
      !hasUnsettled ||
      snapshot.elapsed < unsettledAt
    ) {
      return;
    }

    didNotifyUnsettled = true;
    vars.onUnsettled?.(snapshot);
  };

  const render = (): SpringToSnapshot => {
    const snapshot = snapshotAt(clock.elapsed);
    for (const [property, entry] of Object.entries(active)) {
      const state = snapshot.states[property];
      if (state) entry.write(state.position);
    }
    vars.onUpdate?.(snapshot);
    notifyUnsettled(snapshot);
    return snapshot;
  };

  const complete = (): void => {
    if (killed || didComplete) return;
    clock.elapsed = finiteDuration;
    render();
    didComplete = true;
    vars.onComplete?.();
  };

  const startClock = (): gsap.core.Tween => {
    clock.elapsed = 0;
    didComplete = false;
    didNotifyUnsettled = false;

    if (finiteDuration === 0) {
      render();
      return gsap.to(clock, { elapsed: 0, duration: 0, onComplete: complete });
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
      return runningTween;
    }

    return gsap.to(clock, {
      elapsed: finiteDuration,
      duration: finiteDuration,
      ease: 'none',
      onUpdate: render,
      onComplete: complete,
    });
  };

  activate(buildProperties(requestedTargets));
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
    retarget(targets) {
      if (killed) return;
      const current = snapshotAt(clock.elapsed).states;
      const requested = Object.fromEntries(
        Object.entries(targets).map(([property, value]) => [
          property,
          parseNumericValue(value, property),
        ]),
      );
      const mergedTargets: RequestedTargets = {};
      for (const [property, entry] of Object.entries(active)) {
        const nextTarget = requested[property];
        mergedTargets[property] = nextTarget
          ? nextTarget.unit === undefined && entry.unit !== undefined
            ? { ...nextTarget, unit: entry.unit }
            : nextTarget
          : entry.unit === undefined
            ? { value: entry.target }
            : { value: entry.target, unit: entry.unit };
      }
      for (const [property, value] of Object.entries(requested)) {
        if (!mergedTargets[property]) mergedTargets[property] = value;
      }

      const next = buildProperties(mergedTargets, current);
      if (unsettledPolicy === 'error' && next.hasUnsettled) {
        throw new RangeError('springTo cannot retarget to an unsettled spring in error mode');
      }

      tween.kill();
      activate(next);
      tween = startClock();
    },
    kill() {
      if (killed) return;
      killed = true;
      tween.kill();
    },
  };

  return controller;
}
