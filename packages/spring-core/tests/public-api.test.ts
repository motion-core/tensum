import { describe, expect, it } from 'vitest';
import * as core from '../src/index.js';
import * as coupled from '../src/coupled.js';
import * as css from '../src/css.js';

describe('public API', () => {
  it('keeps the root runtime exports intentional', () => {
    expect(Object.keys(core).sort()).toEqual([
      'CRITICAL_DAMPING_TOLERANCE',
      'DEFAULT_SETTLING_OPTIONS',
      'MOTION_COMPATIBILITY_COMMIT',
      'MOTION_COMPATIBILITY_VERSION',
      'angularFrequency',
      'classifyDamping',
      'createAnalyticalSolver',
      'createSpring',
      'createSpringModel',
      'createVectorSpring',
      'dampingRatio',
      'getSettlingResult',
      'motionSpringParameters',
      'resolveSettlingOptions',
      'springCharacteristics',
      'springParameters',
      'springPresets',
      'validateSettlingOptions',
      'validateSpringParameters',
    ]);
  });

  it('keeps advanced features on explicit subpath exports', () => {
    expect(Object.keys(css)).toEqual(['springToCSSLinear']);
    expect(Object.keys(coupled)).toEqual(['createCoupledSpringSystem']);
  });
});
