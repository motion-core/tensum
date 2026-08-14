export interface VelocitySample<TValue> {
  value: TValue;
  /** Monotonic time in seconds. */
  time: number;
}

export interface VelocityFromSamplesOptions {
  /** Samples older than this many seconds resolve to zero velocity. */
  maxSampleAge?: number;
}

function assertFinite(name: string, value: number): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${name} must be a finite number`);
  }
}

function validateDeltaTime(
  previousTime: number,
  currentTime: number,
  maxSampleAge: number,
): number | undefined {
  assertFinite('previous.time', previousTime);
  assertFinite('current.time', currentTime);
  const deltaTime = currentTime - previousTime;
  if (deltaTime < 0) throw new RangeError('sample times must be monotonic');
  if (deltaTime === 0 || deltaTime > maxSampleAge) return undefined;
  return deltaTime;
}

function resolvedMaxSampleAge(value: number | undefined): number {
  if (value === undefined) return Number.POSITIVE_INFINITY;
  assertFinite('maxSampleAge', value);
  if (value <= 0) throw new RangeError('maxSampleAge must be greater than 0');
  return value;
}

export function velocityFromSamples(
  previous: VelocitySample<number>,
  current: VelocitySample<number>,
  options?: VelocityFromSamplesOptions,
): number;
export function velocityFromSamples(
  previous: VelocitySample<readonly number[]>,
  current: VelocitySample<readonly number[]>,
  options?: VelocityFromSamplesOptions,
): readonly number[];
export function velocityFromSamples(
  previous: VelocitySample<number | readonly number[]>,
  current: VelocitySample<number | readonly number[]>,
  options: VelocityFromSamplesOptions = {},
): number | readonly number[] {
  const deltaTime = validateDeltaTime(
    previous.time,
    current.time,
    resolvedMaxSampleAge(options.maxSampleAge),
  );

  if (typeof previous.value === 'number' && typeof current.value === 'number') {
    assertFinite('previous.value', previous.value);
    assertFinite('current.value', current.value);
    return deltaTime === undefined ? 0 : (current.value - previous.value) / deltaTime;
  }

  if (Array.isArray(previous.value) && Array.isArray(current.value)) {
    const previousValues = previous.value as readonly number[];
    const currentValues = current.value as readonly number[];
    if (previousValues.length !== currentValues.length) {
      throw new RangeError('sample vectors must have the same number of components');
    }
    return Object.freeze(
      previousValues.map((previousValue, index) => {
        const currentValue = currentValues[index]!;
        assertFinite(`previous.value[${index}]`, previousValue);
        assertFinite(`current.value[${index}]`, currentValue);
        return deltaTime === undefined ? 0 : (currentValue - previousValue) / deltaTime;
      }),
    );
  }

  throw new TypeError('sample values must both be numbers or numeric vectors');
}

export function normalizedVelocity(
  velocity: number,
  from: number,
  to: number,
): number {
  assertFinite('velocity', velocity);
  assertFinite('from', from);
  assertFinite('to', to);
  const distance = to - from;
  if (distance === 0) {
    throw new RangeError('normalized velocity requires a non-zero distance');
  }
  return velocity / distance;
}

export function physicalVelocity(
  velocity: number,
  from: number,
  to: number,
): number {
  assertFinite('normalizedVelocity', velocity);
  assertFinite('from', from);
  assertFinite('to', to);
  const result = velocity * (to - from);
  assertFinite('physicalVelocity', result);
  return result;
}
