import { describe, expect, it } from 'vitest';
import { createSpring } from '../src/index.js';

const valid = {
  from: 0,
  to: 100,
  velocity: 0,
  mass: 1,
  stiffness: 100,
  damping: 10,
} as const;

describe('validation', () => {
  it.each([
    ['mass', 0],
    ['mass', -1],
    ['stiffness', 0],
    ['damping', -1],
    ['mass', Number.NaN],
    ['to', Number.POSITIVE_INFINITY],
  ] as const)('rejects invalid %s values', (key, value) => {
    expect(() => createSpring({ ...valid, [key]: value })).toThrow(RangeError);
  });

  it('rejects invalid settling thresholds', () => {
    expect(() => createSpring({ ...valid, settle: { position: 0 } })).toThrow(RangeError);
    expect(() => createSpring({ ...valid, settle: { velocity: Number.NaN } })).toThrow(
      RangeError,
    );
  });

  it('rejects negative or non-finite sample times', () => {
    const spring = createSpring(valid);
    expect(() => spring.stateAt(-0.1)).toThrow(RangeError);
    expect(() => spring.stateAt(Number.NaN)).toThrow(RangeError);
  });
});
