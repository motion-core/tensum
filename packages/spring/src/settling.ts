import { assertFinite } from './math.js';
import type { AnalyticalSolver } from './solver.js';
import type {
  SettlingResult,
  SpringSettleInput,
  SpringSettlingOptions,
} from './types.js';

export const DEFAULT_SETTLING_OPTIONS: Readonly<SpringSettlingOptions> = {
  positionEpsilon: 0.1,
  velocityEpsilon: 0.1,
  maxDuration: 60,
  refinementIterations: 48,
};

export function resolveSettlingOptions(
  input: SpringSettleInput = {},
): Readonly<SpringSettlingOptions> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new TypeError('settle must be an object when provided');
  }
  const options: SpringSettlingOptions = {
    positionEpsilon:
      input.position === undefined
        ? DEFAULT_SETTLING_OPTIONS.positionEpsilon
        : input.position,
    velocityEpsilon:
      input.velocity === undefined
        ? DEFAULT_SETTLING_OPTIONS.velocityEpsilon
        : input.velocity,
    maxDuration:
      input.maxDuration === undefined
        ? DEFAULT_SETTLING_OPTIONS.maxDuration
        : input.maxDuration,
    refinementIterations:
      input.refinementIterations === undefined
        ? DEFAULT_SETTLING_OPTIONS.refinementIterations
        : input.refinementIterations,
  };
  validateSettlingOptions(options);
  return Object.freeze(options);
}

export function validateSettlingOptions(options: SpringSettlingOptions): void {
  assertFinite('positionEpsilon', options.positionEpsilon);
  assertFinite('velocityEpsilon', options.velocityEpsilon);
  assertFinite('maxDuration', options.maxDuration);
  assertFinite('refinementIterations', options.refinementIterations);

  if (options.positionEpsilon <= 0) {
    throw new RangeError('positionEpsilon must be greater than 0');
  }
  if (options.velocityEpsilon <= 0) {
    throw new RangeError('velocityEpsilon must be greater than 0');
  }
  if (options.maxDuration <= 0) {
    throw new RangeError('maxDuration must be greater than 0');
  }
  if (!Number.isInteger(options.refinementIterations)) {
    throw new RangeError('refinementIterations must be an integer');
  }
  if (options.refinementIterations <= 0) {
    throw new RangeError('refinementIterations must be greater than 0');
  }
}

function boundsMeetThresholds(
  solver: AnalyticalSolver,
  time: number,
  options: SpringSettlingOptions,
): boolean {
  const bounds = solver.tailBoundsAt(time);
  return (
    bounds.position <= options.positionEpsilon && bounds.velocity <= options.velocityEpsilon
  );
}

/**
 * Finds the first time at which analytical tail envelopes are below both
 * tolerances. The envelopes bound every future position error and velocity,
 * so an underdamped zero-crossing cannot be mistaken for settlement.
 */
export function getSettlingResult(
  solver: AnalyticalSolver,
  options: SpringSettlingOptions,
): SettlingResult {
  validateSettlingOptions(options);
  const { maxDuration, refinementIterations } = options;

  const initialBounds = solver.tailBoundsAt(0);
  if (initialBounds.position === 0 && initialBounds.velocity === 0) {
    return { duration: 0, iterations: 0, settled: true };
  }

  if (boundsMeetThresholds(solver, 0, options) && solver.tailBoundsMonotonicAfter === 0) {
    return { duration: 0, iterations: 0, settled: true };
  }

  // An undamped non-equilibrium oscillator has a constant analytical envelope.
  if (solver.dampingRatio === 0) {
    return { duration: maxDuration, iterations: 0, settled: false };
  }

  if (solver.tailBoundsMonotonicAfter > maxDuration) {
    return { duration: maxDuration, iterations: 0, settled: false };
  }

  let iterations = 0;
  let lower = solver.tailBoundsMonotonicAfter;
  let upper = Math.max(
    lower,
    Math.min(maxDuration, Math.max(1 / solver.angularFrequency, 1 / 120)),
  );

  if (boundsMeetThresholds(solver, lower, options)) {
    // Critical-damping polynomial envelopes can grow before this point. Using
    // the monotonic boundary is conservative and avoids an invalid binary
    // search across that non-monotonic interval.
    return { duration: lower, iterations, settled: true };
  } else {
    while (upper < maxDuration && !boundsMeetThresholds(solver, upper, options)) {
      lower = upper;
      upper = Math.min(maxDuration, upper * 2);
      iterations += 1;
    }
  }

  if (!boundsMeetThresholds(solver, upper, options)) {
    return { duration: maxDuration, iterations, settled: false };
  }

  for (let index = 0; index < refinementIterations; index += 1) {
    const midpoint = lower + (upper - lower) / 2;
    if (midpoint === lower || midpoint === upper) break;
    if (boundsMeetThresholds(solver, midpoint, options)) upper = midpoint;
    else lower = midpoint;
    iterations += 1;
  }

  return { duration: upper, iterations, settled: true };
}
