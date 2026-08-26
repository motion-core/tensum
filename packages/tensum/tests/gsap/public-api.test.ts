import { describe, expect, it } from 'vitest';
import { gsap } from 'gsap';
import * as spring from '../../src/index.js';
import type {
  MotionSpringEffectTweenVars,
  MotionSpringEffectVars,
} from '../../src/index.js';

describe('GSAP public API', () => {
  it('exposes the complete GSAP surface from the single package entry point', () => {
    expect(spring.SUPPORTED_PROPERTIES).toEqual([
      'x',
      'y',
      'scale',
      'rotation',
    ]);
    expect(spring.TensumPlugin).toBeTypeOf('object');
    expect(spring.createMotionSpringTween).toBeTypeOf('function');
    expect(spring.springTo).toBeTypeOf('function');
  });

  it('exposes the preflighted effect and helper through the root entry point', () => {
    gsap.registerPlugin(spring.TensumPlugin);
    expect(gsap.effects['spring']).toBeTypeOf('function');
    expect(gsap.effects['motionSpring']).toBeUndefined();
    expect((gsap.plugins as Record<string, unknown>)['spring']).toBeUndefined();

    const tweenOptions: MotionSpringEffectTweenVars = { paused: true };
    const vars: MotionSpringEffectVars = {
      x: 100,
      from: { x: 0 },
      parameters: { mass: 1, stiffness: 180, damping: 24 },
      tween: tweenOptions,
    };
    const target = { x: 0 };
    const tween = spring.createMotionSpringTween(target, vars);
    const timeline = gsap.timeline({ paused: true }).spring(
      { x: 0 },
      {
        x: 100,
        from: { x: 0 },
        parameters: vars.parameters,
      },
    );

    expect(tween.duration()).toBeGreaterThan(0);
    expect(timeline.duration()).toBeGreaterThan(0);

    tween.kill();
    timeline.kill();
  });
});
