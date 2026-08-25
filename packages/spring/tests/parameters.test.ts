import { describe, expect, it } from 'vitest';
import {
  springCharacteristics,
  springParameters,
  springPresets,
} from '../src/index.js';

describe('spring parameter converters', () => {
  it('copies, validates, and freezes canonical physics parameters', () => {
    const input = { mass: 2, stiffness: 180, damping: 24 };
    const parameters = springParameters.fromPhysics(input);

    expect(parameters).toEqual(input);
    expect(parameters).not.toBe(input);
    expect(Object.isFrozen(parameters)).toBe(true);
    expect(() => springParameters.fromPhysics({ ...input, mass: 0 })).toThrow(RangeError);
  });

  it('converts response and damping ratio to canonical physics', () => {
    const parameters = springParameters.fromResponse({
      response: 0.5,
      dampingRatio: 0.7,
      mass: 2,
    });

    expect(parameters.mass).toBe(2);
    expect(parameters.stiffness).toBeCloseTo(315.82734083485946, 10);
    expect(parameters.damping).toBeCloseTo(35.18583772020568, 10);
  });

  it('matches the Apple perceptual duration and bounce model', () => {
    const parameters = springParameters.fromPerceptualDuration({
      duration: 0.5,
      bounce: 0.3,
    });

    expect(parameters.mass).toBe(1);
    expect(parameters.stiffness).toBeCloseTo(157.91367041742973, 10);
    expect(parameters.damping).toBeCloseTo(17.59291886010284, 10);
    expect(springCharacteristics(parameters).dampingRatio).toBeCloseTo(0.7, 12);
  });

  it('maps negative bounce to overdamping and rejects its asymptote', () => {
    const parameters = springParameters.fromPerceptualDuration({
      duration: 0.5,
      bounce: -0.5,
    });

    expect(springCharacteristics(parameters).dampingRatio).toBeCloseTo(2, 12);
    expect(() =>
      springParameters.fromPerceptualDuration({ duration: 0.5, bounce: -1 }),
    ).toThrow(RangeError);
    expect(() =>
      springParameters.fromPerceptualDuration({ duration: 0.5, bounce: -2 }),
    ).toThrow(RangeError);
  });

  it('derives an envelope-based settling duration explicitly', () => {
    const duration = 1.2;
    const epsilon = 0.001;
    const parameters = springParameters.fromSettlingDuration({
      duration,
      dampingRatio: 0.8,
      epsilon,
    });
    const characteristics = springCharacteristics(parameters);

    expect(
      Math.exp(-characteristics.dampingRatio * characteristics.angularFrequency * duration),
    ).toBeCloseTo(epsilon, 12);
  });

  it('round-trips canonical characteristics', () => {
    const parameters = springParameters.fromPerceptualDuration({
      duration: 0.7,
      bounce: -0.25,
      mass: 3,
    });
    const characteristics = springCharacteristics(parameters);

    expect(characteristics.response).toBeCloseTo(0.7, 12);
    expect(characteristics.perceptualDuration).toBeCloseTo(0.7, 12);
    expect(characteristics.bounce).toBeCloseTo(-0.25, 12);
    expect(characteristics.regime).toBe('overdamped');
    expect(Object.isFrozen(characteristics)).toBe(true);
  });

  it('rejects explicit null optional converter inputs', () => {
    expect(() =>
      springParameters.fromResponse({
        response: 0.5,
        dampingRatio: 0.7,
        mass: null as never,
      }),
    ).toThrow(RangeError);
  });

  it('keeps representable damping products finite', () => {
    const parameters = springParameters.fromResponse({
      response: 2 * Math.PI,
      dampingRatio: 1e308,
      mass: 1e-308,
    });

    expect(parameters.stiffness).toBe(1e-308);
    expect(parameters.damping).toBeCloseTo(2, 12);
  });
});

describe('perceptual spring presets', () => {
  it.each([
    ['smooth', 0],
    ['snappy', 0.15],
    ['bouncy', 0.3],
  ] as const)('exposes a tunable %s preset', (name, baseBounce) => {
    const parameters = springPresets[name]({ duration: 0.8, extraBounce: 0.05 });
    const characteristics = springCharacteristics(parameters);

    expect(characteristics.perceptualDuration).toBeCloseTo(0.8, 12);
    expect(characteristics.bounce).toBeCloseTo(baseBounce + 0.05, 12);
  });

  it('rejects explicit null preset overrides', () => {
    expect(() => springPresets.smooth({ duration: null as never })).toThrow(
      RangeError,
    );
    expect(() => springPresets.smooth({ extraBounce: null as never })).toThrow(
      RangeError,
    );
  });
});
