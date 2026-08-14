import { describe, expect, it } from 'vitest';
import * as runtime from '../src/index.js';

describe('public API', () => {
  it('keeps runtime exports intentional', () => {
    expect(Object.keys(runtime).sort()).toEqual([
      'createAdditiveSpringValue',
      'createInertia',
      'createSpringKeyframes',
      'createSpringValue',
      'normalizedVelocity',
      'physicalVelocity',
      'snapToGrid',
      'velocityFromSamples',
    ]);
  });
});
