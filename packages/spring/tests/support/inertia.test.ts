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
    expect(() => createInertia({ from: 0, velocity: 1, timeConstant: 0 })).toThrow(
      RangeError,
    );
    expect(() => createInertia({ from: 0, velocity: 1, min: 2, max: 1 })).toThrow(
      RangeError,
    );
    expect(() => snapToGrid(0)).toThrow(RangeError);
    const inertia = createInertia({ from: 0, velocity: 1 });
    expect(() => inertia.stateAt(-1)).toThrow(RangeError);
  });
});
