import { describe, expect, it } from 'vitest';
import { createAnalyticalSolver, createSpring } from '../src/index.js';

const defaults = {
  mass: 1,
  stiffness: 100,
  damping: 12,
  settle: { position: 0.1, velocity: 0.1 },
} as const;

describe('analytical spring', () => {
  it('reproduces its initial position and velocity', () => {
    const spring = createSpring({ from: 10, to: 500, velocity: 1200, ...defaults });

    expect(spring.positionAt(0)).toBeCloseTo(10, 10);
    expect(spring.velocityAt(0)).toBeCloseTo(1200, 10);
  });

  it('converges to its target with positive damping', () => {
    const spring = createSpring({ from: 0, to: 500, velocity: 300, ...defaults });
    const state = spring.stateAt(20);

    expect(state.position).toBeCloseTo(500, 8);
    expect(state.velocity).toBeCloseTo(0, 8);
  });

  it('overshoots in an underdamped regime', () => {
    const spring = createSpring({ from: 0, to: 100, velocity: 0, ...defaults, damping: 4 });
    const samples = Array.from({ length: 100 }, (_, index) => spring.positionAt(index / 100));

    expect(spring.regime).toBe('underdamped');
    expect(Math.max(...samples)).toBeGreaterThan(100);
  });

  it('converges without overshoot at critical damping', () => {
    const spring = createSpring({ from: 0, to: 100, velocity: 0, ...defaults, damping: 20 });
    const samples = Array.from({ length: 200 }, (_, index) => spring.positionAt(index / 50));

    expect(spring.regime).toBe('critical');
    expect(samples.every((position) => position <= 100 + 1e-9)).toBe(true);
    expect(samples.at(-1)).toBeCloseTo(100, 8);
  });

  it('converges without overshoot when overdamped', () => {
    const critical = createSpring({ from: 0, to: 100, velocity: 0, ...defaults, damping: 20 });
    const overdamped = createSpring({ from: 0, to: 100, velocity: 0, ...defaults, damping: 30 });
    const samples = Array.from({ length: 200 }, (_, index) => overdamped.positionAt(index / 50));

    expect(overdamped.regime).toBe('overdamped');
    expect(samples.every((position) => position <= 100 + 1e-9)).toBe(true);
    expect(overdamped.positionAt(0.5)).toBeLessThan(critical.positionAt(0.5));
  });

  it('preserves the established trajectory for moderate overdamping', () => {
    const spring = createSpring({
      from: 0,
      to: 100,
      velocity: 0,
      mass: 1,
      stiffness: 100,
      damping: 30,
    });

    expect(spring.positionAt(0.5)).toBeCloseTo(82.65953497595359, 12);
    expect(spring.velocityAt(0.5)).toBeCloseTo(66.2338936587935, 12);
  });

  it('remains accurate under extreme overdamping', () => {
    const spring = createSpring({
      from: 0,
      to: 1,
      velocity: 0,
      mass: 1,
      stiffness: 1,
      damping: 1e9,
    });

    expect(spring.regime).toBe('overdamped');
    expect(spring.stateAt(0)).toEqual({ position: 0, velocity: 0 });
    expect(spring.positionAt(1e9)).toBeCloseTo(1 - Math.exp(-1), 10);
    expect(spring.velocityAt(1e9)).toBeGreaterThan(0);
  });

  it('is continuous immediately outside the critical damping boundary', () => {
    const criticalDamping = 2 * Math.sqrt(defaults.mass * defaults.stiffness);
    const springs = [1 - 2e-7, 1, 1 + 2e-7].map((ratio) =>
      createSpring({
        from: -40,
        to: 120,
        velocity: 75,
        ...defaults,
        damping: criticalDamping * ratio,
      }),
    );

    expect(springs.map(({ regime }) => regime)).toEqual([
      'underdamped',
      'critical',
      'overdamped',
    ]);

    for (const time of [0, 0.01, 0.1, 0.5, 1]) {
      const states = springs.map((spring) => spring.stateAt(time));
      expect(states[0]!.position).toBeCloseTo(states[1]!.position, 4);
      expect(states[2]!.position).toBeCloseTo(states[1]!.position, 4);
      expect(states[0]!.velocity).toBeCloseTo(states[1]!.velocity, 3);
      expect(states[2]!.velocity).toBeCloseTo(states[1]!.velocity, 3);
    }
  });

  it.each([
    { mass: 1e-6, stiffness: 1e-6, damping: 2e-8 },
    { mass: 1e6, stiffness: 1e12, damping: 2e9 },
    { mass: 1, stiffness: 1, damping: 1e12 },
  ])('keeps state and tail bounds finite for supported parameter extremes', (parameters) => {
    const solver = createAnalyticalSolver(parameters, {
      position: -1e6,
      target: 1e6,
      velocity: 1e6,
    });

    for (const time of [0, 1e-6, 1, 1e6]) {
      const state = solver.stateAt(time);
      const bounds = solver.tailBoundsAt(time);
      expect(Number.isFinite(state.position)).toBe(true);
      expect(Number.isFinite(state.velocity)).toBe(true);
      expect(Number.isFinite(bounds.position)).toBe(true);
      expect(Number.isFinite(bounds.velocity)).toBe(true);
    }
  });

  it('is deterministic regardless of intermediate sampling', () => {
    const direct = createSpring({ from: 0, to: 500, velocity: 250, ...defaults });
    const sampled = createSpring({ from: 0, to: 500, velocity: 250, ...defaults });

    for (const time of [0.016, 0.031, 0.22, 0.499]) sampled.stateAt(time);

    expect(sampled.stateAt(0.5)).toEqual(direct.stateAt(0.5));
  });

  it('is symmetric for positive and negative distances', () => {
    const positive = createSpring({ from: 0, to: 400, velocity: 0, ...defaults });
    const negative = createSpring({ from: 0, to: -400, velocity: 0, ...defaults });

    for (const time of [0, 0.1, 0.4, 1, 2]) {
      expect(negative.positionAt(time)).toBeCloseTo(-positive.positionAt(time), 10);
      expect(negative.velocityAt(time)).toBeCloseTo(-positive.velocityAt(time), 10);
    }
  });

  it('uses initial velocity as physical state', () => {
    const resting = createSpring({ from: 0, to: 500, velocity: 0, ...defaults });
    const moving = createSpring({ from: 0, to: 500, velocity: 1500, ...defaults });

    expect(moving.positionAt(0.05)).toBeGreaterThan(resting.positionAt(0.05));
  });

  it('preserves position and velocity when retargeted', () => {
    const original = createSpring({ from: 0, to: 600, velocity: 500, ...defaults });
    const interruptionTime = 0.27;
    const state = original.stateAt(interruptionTime);
    const retargeted = original.retarget(100, interruptionTime);

    expect(retargeted.positionAt(0)).toBeCloseTo(state.position, 10);
    expect(retargeted.velocityAt(0)).toBeCloseTo(state.velocity, 10);
    expect(retargeted.initialState.target).toBe(100);
  });

  it('converges at the largest finite sample time without producing NaN', () => {
    const spring = createSpring({ from: 0, to: 1, ...defaults });

    expect(spring.stateAt(Number.MAX_VALUE)).toEqual({
      position: 1,
      velocity: 0,
    });
  });

  it('keeps representable critical-damping samples finite when polynomial intermediates overflow', () => {
    const solver = createAnalyticalSolver(
      { mass: 1, stiffness: 1, damping: 2 },
      { position: 0, target: 0, velocity: Number.MAX_VALUE },
    );

    const state = solver.stateAt(2);
    const bounds = solver.tailBoundsAt(2);
    expect(state.position / Number.MAX_VALUE).toBeCloseTo(2 * Math.exp(-2), 12);
    expect(state.velocity / Number.MAX_VALUE).toBeCloseTo(-Math.exp(-2), 12);
    expect(Number.isFinite(bounds.position)).toBe(true);
    expect(Number.isFinite(bounds.velocity)).toBe(true);
  });

  it('keeps representable overdamped modal coefficients finite', () => {
    const solver = createAnalyticalSolver(
      { mass: 1, stiffness: 1, damping: 1e308 },
      { position: 1e308, target: 0, velocity: 0 },
    );

    expect(solver.stateAt(0)).toEqual({ position: 1e308, velocity: 0 });
    const state = solver.stateAt(1);
    expect(Number.isFinite(state.position)).toBe(true);
    expect(Number.isFinite(state.velocity)).toBe(true);
    expect(state.position / 1e308).toBeCloseTo(1, 12);
  });

  it('snapshots the initial state passed to the public analytical solver', () => {
    const initial = { position: 0, velocity: 5, target: 100 };
    const solver = createAnalyticalSolver(defaults, initial);
    const expected = solver.stateAt(0.5);

    initial.position = -1_000;
    initial.velocity = -500;
    initial.target = 2_000;

    expect(solver.stateAt(0)).toEqual({ position: 0, velocity: 5 });
    expect(solver.stateAt(0.5)).toEqual(expected);
  });

  it('rejects sampled states and bounds outside the finite numeric range', () => {
    const solver = createAnalyticalSolver(
      { mass: 1e308, stiffness: 1e-308, damping: 2 },
      { position: 0, velocity: 1e308, target: 0 },
    );

    expect(() => solver.stateAt(1e308)).toThrow(/position must be a finite number/);
    expect(() => solver.tailBoundsAt(1e308)).toThrow(
      /position bound must be a finite number/,
    );
  });
});
