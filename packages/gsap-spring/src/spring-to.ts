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
export type SpringProperty = (typeof SUPPORTED_PROPERTIES)[number];
export type SpringTargets = Partial<Record<SpringProperty, number>>;
export type SpringVelocities = Partial<Record<SpringProperty, number>>;
export type UnsettledPolicy = 'continue' | 'stop' | 'snap' | 'error';

export interface SpringPropertyOptions extends Partial<SpringParameters> {
  velocity?: number;
  settle?: SpringSettleInput;
}

export interface SpringToSnapshot {
  elapsed: number;
  duration: number;
  states: Partial<Record<SpringProperty, SpringState>>;
}

export interface SpringToVars extends SpringTargets {
  spring: SpringParameters & { settle?: SpringSettleInput };
  velocity?: number | SpringVelocities;
  properties?: Partial<Record<SpringProperty, SpringPropertyOptions>>;
  unsettled?: UnsettledPolicy;
  onUpdate?: (snapshot: SpringToSnapshot) => void;
  onUnsettled?: (snapshot: SpringToSnapshot) => void;
  onComplete?: () => void;
}

export interface SpringController {
  readonly duration: number;
  readonly springs: Readonly<Partial<Record<SpringProperty, SpringSolution>>>;
  readonly tween: gsap.core.Tween;
  getSnapshot(): SpringToSnapshot;
  retarget(targets: SpringTargets): void;
  kill(): void;
}

interface ActiveProperty {
  target: number;
  duration: number;
  settling: SettlingResult;
  spring: SpringSolution;
  write: (value: number) => void;
}

interface ActiveProperties {
  entries: Partial<Record<SpringProperty, ActiveProperty>>;
  finiteDuration: number;
  hasUnsettled: boolean;
  unsettledAt: number;
}

function getTargetProperties(vars: SpringTargets): SpringProperty[] {
  return SUPPORTED_PROPERTIES.filter((property) => Number.isFinite(vars[property]));
}

function readNumericProperty(target: gsap.TweenTarget, property: SpringProperty): number {
  const raw = gsap.getProperty(target, property);
  const value = typeof raw === 'number' ? raw : Number.parseFloat(String(raw));
  if (!Number.isFinite(value)) {
    throw new TypeError(`Cannot read a numeric starting value for ${property}`);
  }
  return value;
}

function velocityFor(
  velocity: SpringToVars['velocity'],
  property: SpringProperty,
): number {
  if (typeof velocity === 'number') return velocity;
  return velocity?.[property] ?? 0;
}

function optionsFor(
  vars: SpringToVars,
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

function unitFor(property: SpringProperty): string | undefined {
  if (property === 'x' || property === 'y') return 'px';
  if (property === 'rotation') return 'deg';
  return undefined;
}

/**
 * Animates supported transform properties with GSAP as a clock only. Position
 * and velocity always come from closed-form spring samples at absolute time.
 */
export function springTo(target: gsap.TweenTarget, vars: SpringToVars): SpringController {
  const requestedTargets: SpringTargets = Object.fromEntries(
    getTargetProperties(vars).map((property) => [property, vars[property]]),
  );

  if (Object.keys(requestedTargets).length === 0) {
    throw new TypeError('springTo requires at least one of x, y, scale, or rotation');
  }

  const unsettledPolicy = vars.unsettled ?? 'stop';
  const clock = { elapsed: 0 };
  let active: Partial<Record<SpringProperty, ActiveProperty>> = {};
  let tween: gsap.core.Tween;
  let duration = 0;
  let finiteDuration = 0;
  let hasUnsettled = false;
  let unsettledAt = 0;
  let didComplete = false;
  let didNotifyUnsettled = false;
  let killed = false;

  const buildProperties = (
    targets: SpringTargets,
    inherited?: Partial<Record<SpringProperty, SpringState>>,
  ): ActiveProperties => {
    const next: Partial<Record<SpringProperty, ActiveProperty>> = {};

    for (const property of getTargetProperties(targets)) {
      const to = targets[property]!;
      const from = inherited?.[property]?.position ?? readNumericProperty(target, property);
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
      const setter = gsap.quickSetter(target, property, unitFor(property));
      next[property] = {
        target: to,
        duration: propertyDuration,
        settling,
        spring,
        write(value) {
          setter(value);
        },
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
    const states: SpringToSnapshot['states'] = {};
    for (const property of SUPPORTED_PROPERTIES) {
      const entry = active[property];
      if (!entry) continue;
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
      states,
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
    for (const property of SUPPORTED_PROPERTIES) {
      const entry = active[property];
      const state = snapshot.states[property];
      if (entry && state) entry.write(state.position);
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
      const mergedTargets: SpringTargets = {};
      for (const property of SUPPORTED_PROPERTIES) {
        const entry = active[property];
        const requested = targets[property];
        if (requested !== undefined) mergedTargets[property] = requested;
        else if (entry) mergedTargets[property] = entry.target;
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
