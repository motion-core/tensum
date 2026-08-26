import { describe, expect, it } from 'vitest';
import { createSpring } from '../src/index.js';
import { springToCSSLinear } from '../src/css.js';

function interpolatedProgress(
  samples: readonly { time: number; progress: number }[],
  time: number,
): number {
  const upperIndex = samples.findIndex((sample) => sample.time >= time);
  if (upperIndex <= 0) return samples[Math.max(upperIndex, 0)]!.progress;
  const start = samples[upperIndex - 1]!;
  const end = samples[upperIndex]!;
  const progress = (time - start.time) / (end.time - start.time);
  return start.progress + (end.progress - start.progress) * progress;
}

describe('CSS linear spring export', () => {
  it('adaptively approximates the runtime trajectory within its error budget', () => {
    const spring = createSpring({
      from: 0,
      to: 500,
      velocity: 300,
      mass: 1,
      stiffness: 180,
      damping: 12,
    });
    const exported = springToCSSLinear(spring, { maxError: 0.0005 });
    let measuredError = 0;

    for (let index = 0; index <= 2000; index += 1) {
      const time = (index / 2000) * exported.duration;
      const expected =
        index === 2000
          ? 1
          : spring.positionAt(time) / spring.initialState.target;
      measuredError = Math.max(
        measuredError,
        Math.abs(interpolatedProgress(exported.samples, time) - expected),
      );
    }

    expect(measuredError).toBeLessThanOrEqual(exported.maxError);
    expect(exported.easing.startsWith('linear(')).toBe(true);
    expect(exported.easing.endsWith(')')).toBe(true);
    expect(exported.samples[0]).toEqual({ time: 0, progress: 0 });
    expect(exported.samples.at(-1)).toEqual({
      time: exported.duration,
      progress: 1,
    });
  });

  it('uses more samples for a tighter error budget', () => {
    const spring = createSpring({
      from: 0,
      to: 100,
      mass: 1,
      stiffness: 180,
      damping: 8,
    });

    const loose = springToCSSLinear(spring, { maxError: 0.01 });
    const tight = springToCSSLinear(spring, { maxError: 0.0001 });
    expect(tight.samples.length).toBeGreaterThan(loose.samples.length);
  });

  it.each([
    ['underdamped', 8],
    ['critical', 40],
    ['overdamped', 80],
  ] as const)(
    'certifies the serialized %s trajectory between every sample',
    (_regime, damping) => {
      const spring = createSpring({
        from: -40,
        to: 160,
        velocity: 300,
        mass: 1,
        stiffness: 400,
        damping,
        settle: { position: 0.1, velocity: 0.1 },
      });
      const exported = springToCSSLinear(spring, { maxError: 0.001 });
      let measuredError = 0;

      for (let index = 0; index <= 10_000; index += 1) {
        const time = (index / 10_000) * exported.duration;
        const expected =
          index === 10_000
            ? 1
            : (spring.positionAt(time) - spring.initialState.position) /
              (spring.initialState.target - spring.initialState.position);
        measuredError = Math.max(
          measuredError,
          Math.abs(interpolatedProgress(exported.samples, time) - expected),
        );
      }

      expect(measuredError).toBeLessThanOrEqual(exported.maxError);

      const serialized = exported.easing
        .slice('linear('.length, -1)
        .split(', ')
        .map((entry) => {
          const [progress, percentage] = entry.split(' ');
          return {
            progress: Number(progress),
            time: (Number(percentage!.slice(0, -1)) / 100) * exported.duration,
          };
        });
      expect(serialized).toHaveLength(exported.samples.length);
      for (let index = 0; index < serialized.length; index += 1) {
        expect(serialized[index]!.progress).toBe(exported.samples[index]!.progress);
        expect(serialized[index]!.time).toBeCloseTo(
          exported.samples[index]!.time,
          12,
        );
      }
    },
  );

  it('supports an explicit export duration', () => {
    const spring = createSpring({
      from: 0,
      to: 100,
      mass: 1,
      stiffness: 180,
      damping: 24,
    });
    const exported = springToCSSLinear(spring, { duration: 0.75 });

    expect(exported.duration).toBe(0.75);
    expect(exported.samples.at(-1)!.time).toBe(0.75);
  });

  it('rejects a duration whose terminal snap cannot meet the error budget', () => {
    const spring = createSpring({
      from: 0,
      to: 100,
      mass: 1,
      stiffness: 180,
      damping: 24,
    });

    expect(() => springToCSSLinear(spring, { duration: 0.5 })).toThrow(
      /terminal snap error/,
    );
  });

  it('rejects ambiguous zero-distance and invalid sampling options', () => {
    const zeroDistance = createSpring({
      from: 100,
      to: 100,
      mass: 1,
      stiffness: 180,
      damping: 24,
    });
    const spring = createSpring({
      from: 0,
      to: 100,
      mass: 1,
      stiffness: 180,
      damping: 24,
    });

    expect(() => springToCSSLinear(zeroDistance)).toThrow(RangeError);
    expect(() => springToCSSLinear(spring, { maxError: 0 })).toThrow(
      RangeError,
    );
    expect(() => springToCSSLinear(spring, { maxDepth: 1.5 })).toThrow(
      RangeError,
    );
    expect(() => springToCSSLinear(spring, { maxSamples: 1 })).toThrow(
      RangeError,
    );
    expect(() => springToCSSLinear(spring, { maxDepth: 1 })).toThrow(
      /cannot guarantee maxError/,
    );
    expect(() =>
      springToCSSLinear(spring, { maxError: 0.0001, precision: 1 }),
    ).toThrow(/precision|cannot guarantee maxError/);
    expect(() => springToCSSLinear(spring, { maxDepth: null as never })).toThrow(
      RangeError,
    );
    expect(() => springToCSSLinear(spring, [] as never)).toThrow(TypeError);
  });

  it('rejects trajectories whose normalized CSS progress is not finite', () => {
    const spring = createSpring({
      from: 0,
      to: Number.MIN_VALUE,
      velocity: 1,
      mass: 1,
      stiffness: 180,
      damping: 24,
    });

    expect(() => springToCSSLinear(spring, { duration: 0.1 })).toThrow(
      /normalized progress must be a finite number/,
    );
  });
});
