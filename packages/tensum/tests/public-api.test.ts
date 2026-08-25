import { describe, expect, expectTypeOf, it } from 'vitest';
import * as core from '../src/index.js';
import type {
  MotionSpringEffectVars,
  MotionSpringVars,
  SpringPropertyAdapter,
  SpringToVars,
  SpringTweenTarget,
} from '../src/index.js';
import * as coupled from '../src/coupled.js';
import * as css from '../src/css.js';

describe('single-package public API', () => {
  it('keeps the root GSAP and supporting exports intentional', () => {
    expect(Object.keys(core).sort()).toEqual([
      'CRITICAL_DAMPING_TOLERANCE',
      'DEFAULT_SETTLING_OPTIONS',
      'MOTION_COMPATIBILITY_COMMIT',
      'MOTION_COMPATIBILITY_VERSION',
      'SUPPORTED_PROPERTIES',
      'angularFrequency',
      'classifyDamping',
      'createAdditiveSpringValue',
      'createAnalyticalSolver',
      'createInertia',
      'createMotionSpringTween',
      'createSpring',
      'createSpringKeyframes',
      'createSpringModel',
      'createSpringValue',
      'createVectorSpring',
      'dampingRatio',
      'getSettlingResult',
      'motionSpringParameters',
      'normalizedVelocity',
      'physicalVelocity',
      'registerSpringPlugin',
      'resolveSettlingOptions',
      'snapToGrid',
      'springCharacteristics',
      'springParameters',
      'springPresets',
      'springTo',
      'validateSettlingOptions',
      'validateSpringParameters',
      'velocityFromSamples',
    ]);
  });

  it('keeps advanced features on explicit subpath exports', () => {
    expect(Object.keys(css)).toEqual(['springToCSSLinear']);
    expect(Object.keys(coupled)).toEqual(['createCoupledSpringSystem']);
  });

  it('exports the complete GSAP type contract from the root entry point', () => {
    expectTypeOf<MotionSpringEffectVars>().toMatchTypeOf<MotionSpringVars>();
    expectTypeOf<SpringToVars['adapters']>().toMatchTypeOf<
      Readonly<Partial<Record<string, SpringPropertyAdapter>>> | undefined
    >();
    expectTypeOf<
      Parameters<SpringPropertyAdapter['read']>[0]
    >().toEqualTypeOf<SpringTweenTarget>();
    expectTypeOf<SpringTweenTarget>().toMatchTypeOf<object>();
  });
});
