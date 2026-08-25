import { describe, expect, it } from 'vitest';
import {
  normalizedVelocity,
  physicalVelocity,
  velocityFromSamples,
} from '../../src/index.js';

describe('gesture velocity helpers', () => {
  it('computes physical velocity in value units per second', () => {
    expect(
      velocityFromSamples(
        { value: 10, time: 1 },
        { value: 40, time: 1.05 },
      ),
    ).toBeCloseTo(600, 10);
  });

  it('computes vector axes independently', () => {
    const velocity = velocityFromSamples(
      { value: [10, 20], time: 1 },
      { value: [40, 10], time: 1.05 },
    );

    expect(velocity[0]).toBeCloseTo(600, 10);
    expect(velocity[1]).toBeCloseTo(-200, 10);
  });

  it('returns zero for zero-time and explicitly stale samples', () => {
    expect(
      velocityFromSamples(
        { value: 10, time: 1 },
        { value: 40, time: 1 },
      ),
    ).toBe(0);
    expect(
      velocityFromSamples(
        { value: [10, 20], time: 1 },
        { value: [40, 10], time: 2 },
        { maxSampleAge: 0.1 },
      ),
    ).toEqual([0, 0]);
  });

  it('rejects non-monotonic time and mismatched vectors', () => {
    expect(() =>
      velocityFromSamples(
        { value: 10, time: 2 },
        { value: 40, time: 1 },
      ),
    ).toThrow(RangeError);
    expect(() =>
      velocityFromSamples(
        { value: [0], time: 1 },
        { value: [0, 1], time: 2 },
      ),
    ).toThrow(RangeError);
  });

  it('round-trips normalized and physical velocity', () => {
    const physical = -1200;
    const normalized = normalizedVelocity(physical, 500, 100);

    expect(normalized).toBe(3);
    expect(physicalVelocity(normalized, 500, 100)).toBe(physical);
    expect(() => normalizedVelocity(physical, 100, 100)).toThrow(RangeError);
  });

  it('rejects derived velocities that exceed the finite numeric range', () => {
    expect(() =>
      velocityFromSamples(
        { value: -Number.MAX_VALUE, time: 0 },
        { value: Number.MAX_VALUE, time: 1 },
      ),
    ).toThrow(RangeError);
    expect(() =>
      normalizedVelocity(Number.MAX_VALUE, 0, Number.MIN_VALUE),
    ).toThrow(RangeError);
  });
});
