import { describe, expect, it } from 'vitest';
import { createSpring } from '../src/index.js';

const parameters = {
  mass: 1,
  stiffness: 180,
  damping: 24,
  velocity: 0,
  settle: { position: 0.1, velocity: 0.1 },
} as const;

describe('settling duration', () => {
  it('returns a finite duration whose future tail stays within tolerance', () => {
    const spring = createSpring({ from: 0, to: 500, ...parameters });
    const result = spring.getSettlingResult();

    expect(result.settled).toBe(true);
    expect(result.duration).toBeGreaterThan(0);
    expect(Number.isFinite(result.duration)).toBe(true);

    for (const offset of [0, 0.05, 0.2, 0.5, 1]) {
      const state = spring.stateAt(result.duration + offset);
      expect(Math.abs(state.position - 500)).toBeLessThanOrEqual(0.1 + 1e-9);
      expect(Math.abs(state.velocity)).toBeLessThanOrEqual(0.1 + 1e-9);
    }
  });

  it('derives longer durations for larger distances with absolute tolerances', () => {
    const distances = [10, 100, 1000];
    const durations = distances.map((to) =>
      createSpring({ from: 0, to, ...parameters }).getSettlingDuration(),
    );

    expect(durations[1]).toBeGreaterThan(durations[0]!);
    expect(durations[2]).toBeGreaterThan(durations[1]!);
  });

  it('reports a non-equilibrium undamped spring as unsettled', () => {
    const spring = createSpring({ from: 0, to: 100, ...parameters, damping: 0 });

    expect(spring.getSettlingResult()).toMatchObject({ settled: false, duration: 60 });
  });

  it('honors a public maximum duration for an unsettled spring', () => {
    const spring = createSpring({
      from: 0,
      to: 100,
      ...parameters,
      damping: 0,
      settle: { maxDuration: 2.5 },
    });

    expect(spring.getSettlingResult()).toEqual({
      settled: false,
      duration: 2.5,
      iterations: 0,
    });
  });

  it('resolves and exposes every settling option', () => {
    const spring = createSpring({
      from: 0,
      to: 100,
      ...parameters,
      settle: {
        position: 0.02,
        velocity: 0.03,
        maxDuration: 8,
        refinementIterations: 24,
      },
    });

    expect(spring.settling).toEqual({
      positionEpsilon: 0.02,
      velocityEpsilon: 0.03,
      maxDuration: 8,
      refinementIterations: 24,
    });
    expect(Object.isFrozen(spring.settling)).toBe(true);
  });

  it('preserves the resolved settling configuration when retargeting', () => {
    const spring = createSpring({
      from: 0,
      to: 100,
      ...parameters,
      settle: {
        position: 0.02,
        velocity: 0.03,
        maxDuration: 8,
        refinementIterations: 24,
      },
    });

    expect(spring.retarget(200, 0.2).settling).toEqual(spring.settling);
  });

  it('settles immediately when already at rest at the target', () => {
    const spring = createSpring({ from: 100, to: 100, ...parameters });

    expect(spring.getSettlingResult()).toEqual({ settled: true, duration: 0, iterations: 0 });
  });
});
