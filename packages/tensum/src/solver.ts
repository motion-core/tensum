import {
  angularFrequency,
  assertFinite,
  assertNonNegativeTime,
  classifyDamping,
  dampingDecayRate,
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

function finiteState(
  position: number,
  velocity: number,
  suffix = '',
): SpringState {
  assertFinite(`position${suffix}`, position);
  assertFinite(`velocity${suffix}`, velocity);
  return { position, velocity };
}

function multiplyDivide(
  first: number,
  second: number,
  divisor: number,
): number {
  const firstQuotient = (first / divisor) * second;
  const secondQuotient = first * (second / divisor);
  if (Number.isFinite(firstQuotient)) {
    if (firstQuotient !== 0 || secondQuotient === 0) return firstQuotient;
  }
  return secondQuotient;
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

  // Keep the public solver deterministic if the caller later reuses and
  // mutates its input object.
  const initialPosition = initial.position;
  const initialVelocity = initial.velocity;
  const target = initial.target;

  const omega0 = angularFrequency(parameters);
  const alpha = dampingDecayRate(parameters);
  const zeta = dampingRatio(parameters);

  assertFinite('angularFrequency', omega0);
  assertFinite('dampingDecayRate', alpha);
  assertFinite('dampingRatio', zeta);
  if (omega0 <= 0) {
    throw new RangeError('spring parameters must produce a positive angularFrequency');
  }

  const regime = classifyDamping(zeta);
  const y0 = initialPosition - target;
  const v0 = initialVelocity;

  assertFinite('initial displacement', y0);

  if (regime === 'underdamped') {
    const omegaD =
      omega0 * Math.sqrt(Math.max(0, (1 - zeta) * (1 + zeta)));
    const a = y0;
    const b = (v0 + alpha * y0) / omegaD;
    const velocityCos = -alpha * a + omegaD * b;
    const velocitySin = -alpha * b - omegaD * a;
    const positionAmplitude = Math.hypot(a, b);
    const velocityAmplitude = Math.hypot(velocityCos, velocitySin);

    for (const [name, value] of [
      ['dampedAngularFrequency', omegaD],
      ['positionCoefficient', b],
      ['velocityCosCoefficient', velocityCos],
      ['velocitySinCoefficient', velocitySin],
      ['positionAmplitude', positionAmplitude],
      ['velocityAmplitude', velocityAmplitude],
    ] as const) {
      assertFinite(name, value);
    }

    return {
      angularFrequency: omega0,
      dampingRatio: zeta,
      regime,
      stateAt(time) {
        assertNonNegativeTime(time);
        if (time === 0) {
          return { position: initialPosition, velocity: initialVelocity };
        }
        const decay = Math.exp(-alpha * time);
        if (decay === 0) return { position: target, velocity: 0 };
        const rawPhase = omegaD * time;
        const phase = Number.isFinite(rawPhase)
          ? rawPhase
          : (time % ((2 * Math.PI) / omegaD)) * omegaD;
        const cosine = Math.cos(phase);
        const sine = Math.sin(phase);

        return finiteState(
          target + decay * (a * cosine + b * sine),
          decay * (velocityCos * cosine + velocitySin * sine),
        );
      },
      tailBoundsAt(time) {
        assertNonNegativeTime(time);
        const decay = Math.exp(-alpha * time);
        return finiteState(
          decay * positionAmplitude,
          decay * velocityAmplitude,
          ' bound',
        );
      },
      tailBoundsMonotonicAfter: 0,
    };
  }

  if (regime === 'critical') {
    const a = y0;
    const b = v0 + omega0 * y0;
    const velocityConstant = b - omega0 * a;
    const velocityLinear = -omega0 * b;

    for (const [name, value] of [
      ['positionCoefficient', b],
      ['velocityConstant', velocityConstant],
      ['velocityLinear', velocityLinear],
    ] as const) {
      assertFinite(name, value);
    }

    return {
      angularFrequency: omega0,
      dampingRatio: zeta,
      regime,
      stateAt(time) {
        assertNonNegativeTime(time);
        if (time === 0) {
          return { position: initialPosition, velocity: initialVelocity };
        }
        const decay = Math.exp(-omega0 * time);
        if (decay === 0) return { position: target, velocity: 0 };
        const timeDecay = time * decay;
        return finiteState(
          target + decay * a + timeDecay * b,
          decay * velocityConstant + timeDecay * velocityLinear,
        );
      },
      tailBoundsAt(time) {
        assertNonNegativeTime(time);
        const decay = Math.exp(-omega0 * time);
        if (decay === 0) return { position: 0, velocity: 0 };
        const timeDecay = time * decay;
        return finiteState(
          decay * Math.abs(a) + timeDecay * Math.abs(b),
          decay * Math.abs(velocityConstant) +
            timeDecay * Math.abs(velocityLinear),
          ' bound',
        );
      },
      // Every t·exp(-ωt) term decreases after t = 1/ω.
      tailBoundsMonotonicAfter: 1 / omega0,
    };
  }

  const normalizedFrequency = omega0 / alpha;
  const normalizedOffset = Math.sqrt(
    Math.max(0, (1 - normalizedFrequency) * (1 + normalizedFrequency)),
  );
  const rootFastMagnitude = alpha * (1 + normalizedOffset);
  const rootFast = -rootFastMagnitude;
  // Vieta's relation avoids subtracting two almost equal values in
  // -alpha + sqrt(alpha² - omega0²).
  const rootSlow = -omega0 * (omega0 / rootFastMagnitude);
  const rootSeparation = rootSlow - rootFast;
  const normalizedVelocity = v0 / rootSeparation;
  const coefficientSlow =
    normalizedVelocity - multiplyDivide(rootFast, y0, rootSeparation);
  const coefficientFast =
    multiplyDivide(rootSlow, y0, rootSeparation) - normalizedVelocity;

  for (const [name, value] of [
    ['overdampedSlowRoot', rootSlow],
    ['overdampedFastRoot', rootFast],
    ['overdampedRootSeparation', rootSeparation],
    ['slowModeCoefficient', coefficientSlow],
    ['fastModeCoefficient', coefficientFast],
  ] as const) {
    assertFinite(name, value);
  }
  if (rootSlow >= 0 || rootFast >= 0 || rootSeparation <= 0) {
    throw new RangeError('overdamped roots must be distinct negative finite numbers');
  }

  return {
    angularFrequency: omega0,
    dampingRatio: zeta,
    regime,
    stateAt(time) {
      assertNonNegativeTime(time);
      if (time === 0) {
        return { position: initialPosition, velocity: initialVelocity };
      }
      const slow = coefficientSlow * Math.exp(rootSlow * time);
      const fast = coefficientFast * Math.exp(rootFast * time);
      return finiteState(
        target + slow + fast,
        rootSlow * slow + rootFast * fast,
      );
    },
    tailBoundsAt(time) {
      assertNonNegativeTime(time);
      const slowDecay = Math.exp(rootSlow * time);
      const fastDecay = Math.exp(rootFast * time);
      return finiteState(
        Math.abs(coefficientSlow) * slowDecay +
          Math.abs(coefficientFast) * fastDecay,
        Math.abs(rootSlow * coefficientSlow) * slowDecay +
          Math.abs(rootFast * coefficientFast) * fastDecay,
        ' bound',
      );
    },
    tailBoundsMonotonicAfter: 0,
  };
}
