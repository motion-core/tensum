import type { SpringSolution } from './types.js';

export interface CSSLinearSpringOptions {
  duration?: number;
  maxError?: number;
  maxDepth?: number;
  maxSamples?: number;
  precision?: number;
}

export interface CSSLinearSample {
  time: number;
  progress: number;
}

export interface CSSLinearSpring {
  easing: string;
  duration: number;
  maxError: number;
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
  const result = Number(value.toFixed(precision));
  return Object.is(result, -0) ? '0' : String(result);
}

export function springToCSSLinear(
  spring: SpringSolution,
  options: CSSLinearSpringOptions = {},
): CSSLinearSpring {
  const duration = options.duration ?? spring.timing.settlingDuration;
  const maxError = options.maxError ?? 0.001;
  const maxDepth = options.maxDepth ?? 12;
  const maxSamples = options.maxSamples ?? 4096;
  const precision = options.precision ?? 6;
  assertPositive('duration', duration);
  assertPositive('maxError', maxError);
  assertPositiveInteger('maxDepth', maxDepth);
  assertPositiveInteger('maxSamples', maxSamples);
  if (!Number.isInteger(precision) || precision < 0 || precision > 15) {
    throw new RangeError('precision must be an integer between 0 and 15');
  }

  const distance = spring.initialState.target - spring.initialState.position;
  if (distance === 0) {
    throw new RangeError('CSS spring export requires a non-zero animation distance');
  }

  const progressAt = (time: number): number => {
    if (spring.timing.settled && time >= duration) return 1;
    return (spring.positionAt(time) - spring.initialState.position) / distance;
  };
  const samples: CSSLinearSample[] = [
    { time: 0, progress: progressAt(0) },
  ];

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
    const span = end.time - start.time;
    const checkpoints = [0.25, 0.5, 0.75].map((fraction) => {
      const time = start.time + span * fraction;
      const progress = progressAt(time);
      const linear = start.progress + (end.progress - start.progress) * fraction;
      return { deviation: Math.abs(progress - linear), time, progress };
    });
    const needsRefinement = checkpoints.some(
      ({ deviation }) => deviation > maxError,
    );

    if (needsRefinement && depth < maxDepth) {
      const midpoint = checkpoints[1]!;
      const middle = { time: midpoint.time, progress: midpoint.progress };
      refine(start, middle, depth + 1);
      refine(middle, end, depth + 1);
      return;
    }
    append(end);
  };

  // Quarter-period seeds prevent a high-frequency oscillation from aliasing to
  // deceptively straight midpoint samples before adaptive refinement begins.
  const seedCount = Math.max(
    1,
    Math.ceil((duration * spring.angularFrequency) / (Math.PI / 2)),
  );
  if (seedCount + 1 > maxSamples) {
    throw new RangeError(`CSS linear export requires more than maxSamples (${maxSamples})`);
  }
  for (let index = 0; index < seedCount; index += 1) {
    const start = samples.at(-1)!;
    const time = ((index + 1) / seedCount) * duration;
    refine(start, { time, progress: progressAt(time) }, 0);
  }

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
