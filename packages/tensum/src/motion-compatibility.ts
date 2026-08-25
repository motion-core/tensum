import { assertFinite } from './math.js';
import { springParameters } from './parameters.js';
import type { SpringParameters } from './types.js';

export const MOTION_COMPATIBILITY_VERSION = '13.1.0';
export const MOTION_COMPATIBILITY_COMMIT =
  'adaf7a4e5368d704ea350669f6ac674fb26ff270';

const SAFE_MINIMUM = 0.001;
const ROOT_ITERATIONS = 12;
const MIN_DURATION = 0.01;
const MAX_DURATION = 10;
const MIN_DAMPING_RATIO = 0.05;
const MAX_DAMPING_RATIO = 1;

export interface MotionDurationSpringInput {
  /** Public compatibility input in seconds. Motion's audited generator stores this in ms. */
  duration: number;
  bounce?: number;
}

export interface MotionVisualDurationSpringInput {
  visualDuration: number;
  bounce?: number;
}

export interface MotionSpringParameterConverters {
  fromDuration(input: MotionDurationSpringInput): Readonly<SpringParameters>;
  fromVisualDuration(input: MotionVisualDurationSpringInput): Readonly<SpringParameters>;
}

function clamp(minimum: number, maximum: number, value: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function assertPositive(name: string, value: number): void {
  assertFinite(name, value);
  if (value <= 0) throw new RangeError(`${name} must be greater than 0`);
}

function approximateRoot(
  envelope: (frequency: number) => number,
  derivative: (frequency: number) => number,
  initialGuess: number,
): number {
  let result = initialGuess;
  for (let iteration = 1; iteration < ROOT_ITERATIONS; iteration += 1) {
    result -= envelope(result) / derivative(result);
  }
  return result;
}

function durationParameters(
  requestedDuration: number,
  requestedBounce: number,
): Readonly<SpringParameters> {
  assertPositive('duration', requestedDuration);
  assertFinite('bounce', requestedBounce);

  const duration = clamp(MIN_DURATION, MAX_DURATION, requestedDuration);
  const ratio = clamp(
    MIN_DAMPING_RATIO,
    MAX_DAMPING_RATIO,
    1 - requestedBounce,
  );
  let envelope: (frequency: number) => number;
  let derivative: (frequency: number) => number;

  if (ratio < 1) {
    envelope = (frequency: number): number => {
      const exponentialDecay = frequency * ratio;
      const dampedFrequency = frequency * Math.sqrt(1 - ratio * ratio);
      return (
        SAFE_MINIMUM -
        (exponentialDecay / dampedFrequency) *
          Math.exp(-exponentialDecay * duration)
      );
    };
    derivative = (frequency: number): number => {
      const exponentialDecay = frequency * ratio;
      const squaredDecay = ratio * ratio * frequency * frequency * duration;
      const decay = Math.exp(-exponentialDecay * duration);
      const squaredDampedFrequency =
        frequency * frequency * Math.sqrt(1 - ratio * ratio);
      const factor = -envelope(frequency) + SAFE_MINIMUM > 0 ? -1 : 1;
      return (factor * -squaredDecay * decay) / squaredDampedFrequency;
    };
  } else {
    envelope = (frequency: number): number =>
      -SAFE_MINIMUM +
      Math.exp(-frequency * duration) * (frequency * duration + 1);
    derivative = (frequency: number): number =>
      Math.exp(-frequency * duration) * -frequency * duration * duration;
  }

  const frequency = approximateRoot(envelope, derivative, 5 / duration);
  if (!Number.isFinite(frequency) || frequency <= 0) {
    // This mirrors the audited generator's deterministic fallback, while the
    // compatibility module keeps it explicit and isolated from canonical APIs.
    return springParameters.fromPhysics({ mass: 1, stiffness: 100, damping: 10 });
  }

  return springParameters.fromPhysics({
    mass: 1,
    stiffness: frequency * frequency,
    damping: ratio * 2 * frequency,
  });
}

export const motionSpringParameters: MotionSpringParameterConverters = Object.freeze({
  fromDuration({
    duration,
    bounce = 0.3,
  }: MotionDurationSpringInput): Readonly<SpringParameters> {
    return durationParameters(duration, bounce);
  },
  fromVisualDuration({
    visualDuration,
    bounce = 0,
  }: MotionVisualDurationSpringInput): Readonly<SpringParameters> {
    assertPositive('visualDuration', visualDuration);
    assertFinite('bounce', bounce);
    const frequency = (2 * Math.PI) / (visualDuration * 1.2);
    const ratio = clamp(MIN_DAMPING_RATIO, MAX_DAMPING_RATIO, 1 - bounce);
    return springParameters.fromPhysics({
      mass: 1,
      stiffness: frequency * frequency,
      damping: 2 * ratio * frequency,
    });
  },
});
