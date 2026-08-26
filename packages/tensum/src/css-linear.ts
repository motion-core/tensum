import { createAnalyticalSolver } from './solver.js';
import type { SpringSolution } from './types.js';

export interface CSSLinearSpringOptions {
  /** Export duration in seconds. Its terminal move to progress 1 must fit maxError. */
  duration?: number;
  /** Hard approximation bound in normalized progress units. */
  maxError?: number;
  /** Maximum adaptive subdivision depth; exhaustion throws a RangeError. */
  maxDepth?: number;
  /** Maximum serialized samples; exhaustion throws a RangeError. */
  maxSamples?: number;
  /** Decimal precision for both progress values and percentage stops. */
  precision?: number;
}

export interface CSSLinearSample {
  time: number;
  progress: number;
}

export interface CSSLinearSpring {
  easing: string;
  duration: number;
  /** Certified bound for the serialized easing in normalized progress units. */
  maxError: number;
  /** Rounded samples exactly represented by the serialized easing. */
  samples: readonly Readonly<CSSLinearSample>[];
}

function assertPositive(name: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a finite number greater than 0`);
  }
}

function assertPositiveInteger(name: string, value: number): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive integer`);
  }
}

function rounded(value: number, precision: number): string {
  const result = roundedNumber(value, precision);
  return Object.is(result, -0) ? '0' : String(result);
}

function roundedNumber(value: number, precision: number): number {
  const result = Number(value.toFixed(precision));
  return Object.is(result, -0) ? 0 : result;
}

function logAdd(first: number, second: number): number {
  if (first === Number.NEGATIVE_INFINITY) return second;
  if (second === Number.NEGATIVE_INFINITY) return first;
  const maximum = Math.max(first, second);
  return maximum + Math.log(Math.exp(first - maximum) + Math.exp(second - maximum));
}

function logMagnitude(value: number): number {
  return value === 0 ? Number.NEGATIVE_INFINITY : Math.log(Math.abs(value));
}

export function springToCSSLinear(
  spring: SpringSolution,
  options: CSSLinearSpringOptions = {},
): CSSLinearSpring {
  if (typeof options !== 'object' || options === null || Array.isArray(options)) {
    throw new TypeError('CSS linear options must be an object when provided');
  }
  const duration =
    options.duration === undefined ? spring.timing.settlingDuration : options.duration;
  const maxError = options.maxError === undefined ? 0.001 : options.maxError;
  const maxDepth = options.maxDepth === undefined ? 12 : options.maxDepth;
  const maxSamples = options.maxSamples === undefined ? 4096 : options.maxSamples;
  const precision = options.precision === undefined ? 6 : options.precision;
  assertPositive('duration', duration);
  assertPositive('maxError', maxError);
  assertPositiveInteger('maxDepth', maxDepth);
  assertPositiveInteger('maxSamples', maxSamples);
  if (!Number.isInteger(precision) || precision < 0 || precision > 15) {
    throw new RangeError('precision must be an integer between 0 and 15');
  }

  const distance = spring.initialState.target - spring.initialState.position;
  if (!Number.isFinite(distance)) {
    throw new RangeError('CSS spring animation distance must be a finite number');
  }
  if (distance === 0) {
    throw new RangeError('CSS spring export requires a non-zero animation distance');
  }

  const progressAt = (time: number): number => {
    const progress =
      (spring.positionAt(time) - spring.initialState.position) / distance;
    if (!Number.isFinite(progress)) {
      throw new RangeError('normalized progress must be a finite number');
    }
    return progress;
  };
  const solver = createAnalyticalSolver(
    spring.parameters,
    spring.initialState,
  );
  const terminalSnapError = Math.abs(progressAt(duration) - 1);
  if (terminalSnapError >= maxError) {
    throw new RangeError(
      `CSS linear export duration requires a terminal snap error (${terminalSnapError}) that cannot satisfy maxError (${maxError})`,
    );
  }

  const accelerationErrorBound = (start: number, end: number): number => {
    const bounds = solver.tailBoundsAt(start);
    let logPositionBound = logMagnitude(bounds.position);
    let logVelocityBound = logMagnitude(bounds.velocity);
    if (start < solver.tailBoundsMonotonicAfter) {
      const peakBounds = solver.tailBoundsAt(
        solver.tailBoundsMonotonicAfter,
      );
      // Critical springs contain t*exp(-omega*t) terms. Adding the bounds at
      // the interval start and their monotonic boundary conservatively covers
      // the separate constant and polynomial maxima before that boundary.
      logPositionBound = logAdd(
        logPositionBound,
        logMagnitude(peakBounds.position),
      );
      logVelocityBound = logAdd(
        logVelocityBound,
        logMagnitude(peakBounds.velocity),
      );
    }

    const logDistance = Math.log(Math.abs(distance));
    const logStiffnessAcceleration =
      2 * Math.log(spring.angularFrequency) +
      logPositionBound -
      logDistance;
    const logDampingAcceleration =
      spring.parameters.damping === 0 ||
      logVelocityBound === Number.NEGATIVE_INFINITY
        ? Number.NEGATIVE_INFINITY
        : Math.log(spring.parameters.damping) -
          Math.log(spring.parameters.mass) +
          logVelocityBound -
          logDistance;
    const logAcceleration = logAdd(
      logStiffnessAcceleration,
      logDampingAcceleration,
    );
    const span = end - start;
    if (span === 0 || logAcceleration === Number.NEGATIVE_INFINITY) return 0;
    const logError = logAcceleration + 2 * Math.log(span) - Math.log(8);
    return logError > Math.log(Number.MAX_VALUE)
      ? Number.POSITIVE_INFINITY
      : Math.exp(logError);
  };

  const serializedTime = (time: number): number => {
    if (time <= 0) return 0;
    if (time >= duration) return duration;
    const percentage = roundedNumber((time / duration) * 100, precision);
    return (percentage / 100) * duration;
  };

  const serializedSample = (
    time: number,
    terminal = false,
  ): CSSLinearSample => {
    const serialized = serializedTime(time);
    return {
      time: serialized,
      progress: terminal ? 1 : roundedNumber(progressAt(serialized), precision),
    };
  };

  const samples: CSSLinearSample[] = [serializedSample(0)];

  const append = (sample: CSSLinearSample): void => {
    if (samples.length >= maxSamples) {
      throw new RangeError(`CSS linear export exceeded maxSamples (${maxSamples})`);
    }
    samples.push(sample);
  };

  const refine = (
    start: CSSLinearSample,
    end: CSSLinearSample,
    depth: number,
  ): void => {
    const endpointError = Math.max(
      Math.abs(progressAt(start.time) - start.progress),
      Math.abs(progressAt(end.time) - end.progress),
    );
    const certifiedError =
      endpointError + accelerationErrorBound(start.time, end.time);
    if (certifiedError <= maxError) {
      append(end);
      return;
    }

    if (depth >= maxDepth) {
      throw new RangeError(
        `CSS linear export cannot guarantee maxError (${maxError}) within maxDepth (${maxDepth})`,
      );
    }

    const midpointTime = serializedTime(
      start.time + (end.time - start.time) / 2,
    );
    if (midpointTime === start.time || midpointTime === end.time) {
      throw new RangeError(
        `CSS linear export precision (${precision}) is insufficient to guarantee maxError (${maxError})`,
      );
    }
    const middle = serializedSample(midpointTime);
    refine(start, middle, depth + 1);
    refine(middle, end, depth + 1);
  };

  // A linear interpolation error is bounded by h^2/8 times the maximum
  // normalized acceleration. Analytical tail envelopes provide that maximum
  // without relying on checkpoints that can alias an oscillation.
  refine(samples[0]!, serializedSample(duration, true), 0);

  const frozenSamples = Object.freeze(
    samples.map((sample) => Object.freeze({ ...sample })),
  );
  const easing = `linear(${frozenSamples
    .map(
      (sample) =>
        `${rounded(sample.progress, precision)} ${rounded(
          (sample.time / duration) * 100,
          precision,
        )}%`,
    )
    .join(', ')})`;

  return Object.freeze({ easing, duration, maxError, samples: frozenSamples });
}
