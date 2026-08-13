import {
  angularFrequency,
  assertFinite,
  assertNonNegativeTime,
  classifyDamping,
  dampingRatio,
} from './math.js';
import type {
  SpringInitialState,
  SpringParameters,
  SpringRegime,
  SpringState,
} from './types.js';

export interface AnalyticalSolver {
  readonly angularFrequency: number;
  readonly dampingRatio: number;
  readonly regime: SpringRegime;
  stateAt(time: number): SpringState;
  tailBoundsAt(time: number): SpringState;
  tailBoundsMonotonicAfter: number;
}

export function validateSpringParameters(parameters: SpringParameters): void {
  assertFinite('mass', parameters.mass);
  assertFinite('stiffness', parameters.stiffness);
  assertFinite('damping', parameters.damping);

  if (parameters.mass <= 0) throw new RangeError('mass must be greater than 0');
  if (parameters.stiffness <= 0) throw new RangeError('stiffness must be greater than 0');
  if (parameters.damping < 0) throw new RangeError('damping must be greater than or equal to 0');
}

export function validateInitialState(initial: SpringInitialState): void {
  assertFinite('position', initial.position);
  assertFinite('velocity', initial.velocity);
  assertFinite('target', initial.target);
}

/**
 * Solves m·x″ + c·x′ + k·(x - target) = 0 in closed form.
 * Every sample is calculated from the initial conditions and absolute time.
 */
export function createAnalyticalSolver(
  parameters: SpringParameters,
  initial: SpringInitialState,
): AnalyticalSolver {
  validateSpringParameters(parameters);
  validateInitialState(initial);

  const omega0 = angularFrequency(parameters);
  const zeta = dampingRatio(parameters);
  const regime = classifyDamping(zeta);
  const y0 = initial.position - initial.target;
  const v0 = initial.velocity;
  const alpha = parameters.damping / (2 * parameters.mass);

  if (regime === 'underdamped') {
    const omegaD = Math.sqrt(Math.max(0, omega0 * omega0 - alpha * alpha));
    const a = y0;
    const b = (v0 + alpha * y0) / omegaD;
    const velocityCos = -alpha * a + omegaD * b;
    const velocitySin = -alpha * b - omegaD * a;
    const positionAmplitude = Math.hypot(a, b);
    const velocityAmplitude = Math.hypot(velocityCos, velocitySin);

    return {
      angularFrequency: omega0,
      dampingRatio: zeta,
      regime,
      stateAt(time) {
        assertNonNegativeTime(time);
        const decay = Math.exp(-alpha * time);
        const phase = omegaD * time;
        const cosine = Math.cos(phase);
        const sine = Math.sin(phase);

        return {
          position: initial.target + decay * (a * cosine + b * sine),
          velocity: decay * (velocityCos * cosine + velocitySin * sine),
        };
      },
      tailBoundsAt(time) {
        assertNonNegativeTime(time);
        const decay = Math.exp(-alpha * time);
        return {
          position: decay * positionAmplitude,
          velocity: decay * velocityAmplitude,
        };
      },
      tailBoundsMonotonicAfter: 0,
    };
  }

  if (regime === 'critical') {
    const a = y0;
    const b = v0 + omega0 * y0;
    const velocityConstant = b - omega0 * a;
    const velocityLinear = -omega0 * b;

    return {
      angularFrequency: omega0,
      dampingRatio: zeta,
      regime,
      stateAt(time) {
        assertNonNegativeTime(time);
        const decay = Math.exp(-omega0 * time);
        return {
          position: initial.target + decay * (a + b * time),
          velocity: decay * (velocityConstant + velocityLinear * time),
        };
      },
      tailBoundsAt(time) {
        assertNonNegativeTime(time);
        const decay = Math.exp(-omega0 * time);
        return {
          position: decay * (Math.abs(a) + Math.abs(b) * time),
          velocity:
            decay * (Math.abs(velocityConstant) + Math.abs(velocityLinear) * time),
        };
      },
      // Every t·exp(-ωt) term decreases after t = 1/ω.
      tailBoundsMonotonicAfter: 1 / omega0,
    };
  }

  const rootOffset = Math.sqrt(Math.max(0, alpha * alpha - omega0 * omega0));
  const rootSlow = -alpha + rootOffset;
  const rootFast = -alpha - rootOffset;
  const coefficientSlow = (v0 - rootFast * y0) / (rootSlow - rootFast);
  const coefficientFast = y0 - coefficientSlow;

  return {
    angularFrequency: omega0,
    dampingRatio: zeta,
    regime,
    stateAt(time) {
      assertNonNegativeTime(time);
      const slow = coefficientSlow * Math.exp(rootSlow * time);
      const fast = coefficientFast * Math.exp(rootFast * time);
      return {
        position: initial.target + slow + fast,
        velocity: rootSlow * slow + rootFast * fast,
      };
    },
    tailBoundsAt(time) {
      assertNonNegativeTime(time);
      const slowDecay = Math.exp(rootSlow * time);
      const fastDecay = Math.exp(rootFast * time);
      return {
        position:
          Math.abs(coefficientSlow) * slowDecay + Math.abs(coefficientFast) * fastDecay,
        velocity:
          Math.abs(rootSlow * coefficientSlow) * slowDecay +
          Math.abs(rootFast * coefficientFast) * fastDecay,
      };
    },
    tailBoundsMonotonicAfter: 0,
  };
}
