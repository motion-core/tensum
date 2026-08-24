import { describe, expect, it } from 'vitest';
import * as spring from '../../src/index.js';

describe('supporting public API', () => {
  it('preserves supporting utilities on the single package entry point', () => {
    const utilityExports = [
      'createAdditiveSpringValue',
      'createInertia',
      'createSpringKeyframes',
      'createSpringValue',
      'normalizedVelocity',
      'physicalVelocity',
      'snapToGrid',
      'velocityFromSamples',
    ] as const;

    for (const name of utilityExports) expect(spring[name]).toBeTypeOf('function');
  });
});
