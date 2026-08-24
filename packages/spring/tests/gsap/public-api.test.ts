import { describe, expect, it } from 'vitest';
import * as spring from '../../src/index.js';

describe('GSAP public API', () => {
  it('exposes the complete plugin surface from the single package entry point', () => {
    expect(spring.MotionCoreSpringPlugin.name).toBe('motionSpring');
    expect(spring.SpringPlugin).toBe(spring.MotionCoreSpringPlugin);
    expect(spring.SUPPORTED_PROPERTIES).toEqual(['x', 'y', 'scale', 'rotation']);
    expect(spring.registerMotionCoreSpringPlugin).toBeTypeOf('function');
    expect(spring.registerSpringPlugin).toBe(spring.registerMotionCoreSpringPlugin);
    expect(spring.springTo).toBeTypeOf('function');
  });
});
