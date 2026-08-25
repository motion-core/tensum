import { describe, expect, it } from 'vitest';
import { createInertia, snapToGrid } from '../../src/index.js';

describe('inertia and bounds', () => {
  it('preserves initial state and converges to its natural decay target', () => {
    const inertia = createInertia({
      from: 10,
      velocity: 400,
      timeConstant: 0.5,
    });

    expect(inertia.stateAt(0)).toEqual({ position: 10, velocity: 400 });
    expect(inertia.naturalTarget).toBe(210);
    expect(inertia.target).toBe(210);
    expect(inertia.positionAt(inertia.duration)).toBe(210);
    expect(inertia.velocityAt(inertia.duration)).toBe(0);
    expect(inertia.settled).toBe(true);
  });

  it('modifies the target without changing input position or velocity', () => {
    const inertia = createInertia({
      from: 10,
      velocity: 400,
      timeConstant: 0.5,
      modifyTarget: snapToGrid(100),
    });

    expect(inertia.naturalTarget).toBe(210);
    expect(inertia.target).toBe(200);
    expect(inertia.stateAt(0)).toEqual({ position: 10, velocity: 400 });
    expect(inertia.positionAt(inertia.duration)).toBe(200);
  });

  it('transfers exact impact velocity into a boundary spring', () => {
    const inertia = createInertia({
      from: 0,
      velocity: 1000,
      timeConstant: 0.5,
      max: 200,
    });
    const boundary = inertia.boundary!;
    const before = inertia.stateAt(boundary.time);

    expect(boundary.bound).toBe(200);
    expect(boundary.spring.positionAt(0)).toBeCloseTo(before.position, 10);
    expect(boundary.spring.velocityAt(0)).toBeCloseTo(before.velocity, 10);
    expect(boundary.incomingVelocity).toBeCloseTo(before.velocity, 10);
    expect(inertia.phaseAt(boundary.time)).toBe('spring');
    expect(inertia.positionAt(inertia.duration)).toBe(200);
  });

  it('springs immediately back from an out-of-bounds initial state', () => {
    const inertia = createInertia({
      from: 250,
      velocity: 100,
      min: 0,
      max: 200,
    });

    expect(inertia.boundary).toMatchObject({ time: 0, bound: 200 });
    expect(inertia.stateAt(0)).toEqual({ position: 250, velocity: 100 });
    expect(inertia.positionAt(inertia.duration)).toBe(200);
  });

  it('is deterministic regardless of sampling order', () => {
    const direct = createInertia({ from: 0, velocity: 1000, max: 200 });
    const sampled = createInertia({ from: 0, velocity: 1000, max: 200 });

    for (const time of [0.4, 0.01, 1, 0.2]) sampled.stateAt(time);
    expect(sampled.stateAt(0.5)).toEqual(direct.stateAt(0.5));
  });

  it('validates bounds, time constants, grid size, and sample time', () => {
    expect(() =>
      createInertia({ from: 0, velocity: 1, timeConstant: 0 }),
    ).toThrow(RangeError);
    expect(() =>
      createInertia({ from: 0, velocity: 1, min: 2, max: 1 }),
    ).toThrow(RangeError);
    expect(() => snapToGrid(0)).toThrow(RangeError);
    const inertia = createInertia({ from: 0, velocity: 1 });
    expect(() => inertia.stateAt(-1)).toThrow(RangeError);
  });

  it('does not claim settlement before the decay envelope becomes monotonic', () => {
    const inertia = createInertia({
      from: 0,
      velocity: 1,
      timeConstant: 1,
      modifyTarget: () => 0,
      settle: {
        position: 0.1,
        velocity: 2,
        maxDuration: 0.01,
      },
    });

    expect(inertia.getSettlingResult()).toMatchObject({
      duration: 0.01,
      settled: false,
    });
  });

  it('detects a narrow boundary crossing between frame-sized samples', () => {
    const timeConstant = 0.73;
    const velocity = 10_000;
    const peak = (velocity * timeConstant) / Math.E;
    const inertia = createInertia({
      from: 0,
      velocity,
      timeConstant,
      modifyTarget: () => 0,
      max: peak - 0.001,
    });

    expect(inertia.boundary).toBeDefined();
    expect(inertia.boundary!.time).toBeLessThan(timeConstant);
    expect(inertia.boundary!.bound).toBe(peak - 0.001);
  });

  it('rejects an invalid boundary spring even when no boundary is crossed', () => {
    expect(() =>
      createInertia({
        from: 0,
        velocity: 10,
        boundarySpring: { mass: 0, stiffness: 100, damping: 10 },
      }),
    ).toThrow(RangeError);
  });

  it('rejects explicit null options and invalid modifier output', () => {
    expect(() =>
      createInertia({ from: 0, velocity: 100, timeConstant: null as never }),
    ).toThrow(RangeError);
    expect(() =>
      createInertia({
        from: 0,
        velocity: 100,
        modifyTarget: () => null as never,
      }),
    ).toThrow(RangeError);
  });

  it('stops decay refinement at floating-point precision', () => {
    const inertia = createInertia({
      from: 0,
      velocity: 100,
      settle: { refinementIterations: 10_000 },
    });

    expect(inertia.getSettlingResult().iterations).toBeLessThan(1_000);
  });

  it('keeps representable decay samples finite when polynomial intermediates overflow', () => {
    const inertia = createInertia({
      from: 0,
      velocity: Number.MAX_VALUE,
      timeConstant: 0.5,
      modifyTarget: () => 0,
      settle: { maxDuration: 3 },
    });

    const state = inertia.stateAt(2);
    expect(state.position / Number.MAX_VALUE).toBeCloseTo(2 * Math.exp(-4), 12);
    expect(state.velocity / Number.MAX_VALUE).toBeCloseTo(-3 * Math.exp(-4), 12);
  });

  it('rejects a grid result that exceeds the finite numeric range', () => {
    const snap = snapToGrid(Number.MIN_VALUE, -Number.MAX_VALUE);

    expect(() => snap(Number.MAX_VALUE)).toThrow(RangeError);
  });

  it('rejects decay coefficients and aggregate durations outside the finite range', () => {
    expect(() =>
      createInertia({
        from: Number.MAX_VALUE,
        velocity: 0,
        modifyTarget: () => -Number.MAX_VALUE,
      }),
    ).toThrow(/displacement must be a finite number/);

    expect(() =>
      createInertia({
        from: 0,
        velocity: 1,
        timeConstant: 1e308,
        max: 7e307,
        boundarySpring: { mass: 1, stiffness: 1, damping: 0 },
        settle: { maxDuration: 1.7e308 },
      }),
    ).toThrow(/duration must be a finite number/);
  });
});
