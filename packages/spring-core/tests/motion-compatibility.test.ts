import { describe, expect, it } from 'vitest';
import {
  MOTION_COMPATIBILITY_COMMIT,
  MOTION_COMPATIBILITY_VERSION,
  motionSpringParameters,
  springCharacteristics,
} from '../src/index.js';

describe('Motion parameter compatibility profile', () => {
  it('pins the audited upstream reference', () => {
    expect(MOTION_COMPATIBILITY_VERSION).toBe('13.1.0');
    expect(MOTION_COMPATIBILITY_COMMIT).toBe(
      'adaf7a4e5368d704ea350669f6ac674fb26ff270',
    );
  });

  it.each([
    {
      duration: 0.8,
      bounce: 0.3,
      stiffness: 151.27913277946348,
      damping: 17.21938152918822,
    },
    {
      duration: 0.5,
      bounce: 0,
      stiffness: 341.02369770847105,
      damping: 36.933653905806345,
    },
    {
      duration: 0.3,
      bounce: 0.9,
      stiffness: 23615.44577917556,
      damping: 30.73463569276561,
    },
  ])('matches duration/bounce fixture $duration/$bounce', (fixture) => {
    const parameters = motionSpringParameters.fromDuration(fixture);

    expect(parameters).toEqual({
      mass: 1,
      stiffness: fixture.stiffness,
      damping: fixture.damping,
    });
  });

  it('matches the audited visualDuration conversion', () => {
    const parameters = motionSpringParameters.fromVisualDuration({
      visualDuration: 0.3,
      bounce: 0.3,
    });

    expect(parameters).toEqual({
      mass: 1,
      stiffness: 304.61741978670864,
      damping: 24.434609527920614,
    });
  });

  it('preserves Motion clamping semantics inside the compatibility boundary', () => {
    const short = motionSpringParameters.fromDuration({ duration: 0.001, bounce: 0.3 });
    const long = motionSpringParameters.fromDuration({ duration: 20, bounce: 0.3 });
    const highBounce = motionSpringParameters.fromVisualDuration({
      visualDuration: 0.4,
      bounce: 0.99,
    });

    expect(short.stiffness).toBeCloseTo(968186.4497885663, 8);
    expect(long.stiffness).toBeCloseTo(0.9681864497885664, 12);
    expect(springCharacteristics(highBounce).dampingRatio).toBeCloseTo(0.05, 12);
  });
});
