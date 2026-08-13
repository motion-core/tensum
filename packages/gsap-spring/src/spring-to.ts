import { createSpring } from '@motion-core/spring';
import type {
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

export interface SpringToSnapshot {
  elapsed: number;
  duration: number;
  states: Partial<Record<SpringProperty, SpringState>>;
}

export interface SpringToVars extends SpringTargets {
  spring: SpringParameters & { settle?: Partial<SpringSettleInput> };
  velocity?: number | SpringVelocities;
  onUpdate?: (snapshot: SpringToSnapshot) => void;
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
  spring: SpringSolution;
  write: (value: number) => void;
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

  const clock = { elapsed: 0 };
  let active: Partial<Record<SpringProperty, ActiveProperty>> = {};
  let tween: gsap.core.Tween;
  let duration = 0;

  const buildProperties = (
    targets: SpringTargets,
    inherited?: Partial<Record<SpringProperty, SpringState>>,
  ): void => {
    const next: Partial<Record<SpringProperty, ActiveProperty>> = {};

    for (const property of getTargetProperties(targets)) {
      const to = targets[property]!;
      const from = inherited?.[property]?.position ?? readNumericProperty(target, property);
      const velocity = inherited?.[property]?.velocity ?? velocityFor(vars.velocity, property);
      const spring = createSpring({
        from,
        to,
        velocity,
        ...vars.spring,
      });
      const propertyDuration = spring.getSettlingDuration();
      const setter = gsap.quickSetter(target, property, unitFor(property));
      next[property] = {
        target: to,
        duration: propertyDuration,
        spring,
        write(value) {
          setter(value);
        },
      };
    }

    active = next;
    duration = Math.max(...Object.values(active).map((entry) => entry.duration), 0);
  };

  const snapshotAt = (elapsed: number): SpringToSnapshot => {
    const states: SpringToSnapshot['states'] = {};
    for (const property of SUPPORTED_PROPERTIES) {
      const entry = active[property];
      if (!entry) continue;
      if (elapsed >= entry.duration) {
        states[property] = { position: entry.target, velocity: 0 };
      } else {
        states[property] = entry.spring.stateAt(elapsed);
      }
    }
    return { elapsed: Math.min(elapsed, duration), duration, states };
  };

  const render = (): void => {
    const snapshot = snapshotAt(clock.elapsed);
    for (const property of SUPPORTED_PROPERTIES) {
      const entry = active[property];
      const state = snapshot.states[property];
      if (entry && state) entry.write(state.position);
    }
    vars.onUpdate?.(snapshot);
  };

  const complete = (): void => {
    clock.elapsed = duration;
    render();
    vars.onComplete?.();
  };

  const startClock = (): gsap.core.Tween => {
    clock.elapsed = 0;
    if (duration === 0) {
      render();
      return gsap.to(clock, { elapsed: 0, duration: 0, onComplete: complete });
    }
    return gsap.to(clock, {
      elapsed: duration,
      duration,
      ease: 'none',
      onUpdate: render,
      onComplete: complete,
    });
  };

  buildProperties(requestedTargets);
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
      const current = snapshotAt(clock.elapsed).states;
      const mergedTargets: SpringTargets = {};
      for (const property of SUPPORTED_PROPERTIES) {
        const entry = active[property];
        const requested = targets[property];
        if (requested !== undefined) mergedTargets[property] = requested;
        else if (entry) mergedTargets[property] = entry.target;
      }

      tween.kill();
      buildProperties(mergedTargets, current);
      tween = startClock();
    },
    kill() {
      tween.kill();
    },
  };

  return controller;
}
