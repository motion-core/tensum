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

    expect(measuredError).toBeLessThanOrEqual(exported.maxError * 1.1);
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

  it('supports an explicit export duration', () => {
    const spring = createSpring({
      from: 0,
      to: 100,
      mass: 1,
      stiffness: 180,
      damping: 24,
    });
    const exported = springToCSSLinear(spring, { duration: 0.5 });

    expect(exported.duration).toBe(0.5);
    expect(exported.samples.at(-1)!.time).toBe(0.5);
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
    expect(() => springToCSSLinear(spring, { maxError: 0 })).toThrow(RangeError);
    expect(() => springToCSSLinear(spring, { maxDepth: 1.5 })).toThrow(RangeError);
    expect(() => springToCSSLinear(spring, { maxSamples: 1 })).toThrow(RangeError);
  });
});
