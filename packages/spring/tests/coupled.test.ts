import { describe, expect, it } from 'vitest';
import { createCoupledSpringSystem } from '../src/coupled.js';

describe('coupled spring systems', () => {
  it('applies equal and opposite connection forces', () => {
    const system = createCoupledSpringSystem({
      particles: [
        { mass: 1, position: 0 },
        { mass: 2, position: 2 },
      ],
      connections: [
        { from: 0, to: 1, stiffness: 100, damping: 0, restOffset: 1 },
      ],
    });
    const force = system.forceAt(system.initialState);

    expect(force[0]).toBe(100);
    expect(force[1]).toBe(-100);
    expect(system.accelerationAt(system.initialState)).toEqual([100, -50]);
  });

  it('transfers motion between connected particles', () => {
    const system = createCoupledSpringSystem({
      particles: [
        { mass: 1, position: 0, velocity: 10 },
        { mass: 1, position: 1, velocity: 0 },
      ],
      connections: [
        { from: 0, to: 1, stiffness: 100, damping: 1, restOffset: 1 },
      ],
    });
    const state = system.stateAt(0.2);

    expect(state.velocity[1]).toBeGreaterThan(0);
    expect(state.position[1]).toBeGreaterThan(1);
  });

  it('approximately conserves energy without damping or constraints', () => {
    const system = createCoupledSpringSystem({
      particles: [
        { mass: 1, position: 0, velocity: 5 },
        { mass: 1, position: 1, velocity: -5 },
      ],
      connections: [
        { from: 0, to: 1, stiffness: 100, damping: 0, restOffset: 1 },
      ],
      maxStep: 1 / 1000,
    });
    const initialEnergy = system.energyAt(system.initialState);
    const finalEnergy = system.energyAt(system.stateAt(2));

    expect(finalEnergy).toBeCloseTo(initialEnergy, 7);
  });

  it('supports fixed particles, anchors, and reusable output buffers', () => {
    const system = createCoupledSpringSystem({
      particles: [
        { mass: 1, position: 0, fixed: true },
        {
          mass: 1,
          position: 2,
          anchor: { target: 1, stiffness: 20, damping: 2 },
        },
      ],
      connections: [
        { from: 0, to: 1, stiffness: 100, damping: 2, restOffset: 1 },
      ],
    });
    const output = { position: [0, 0], velocity: [0, 0] };

    expect(system.advanceInto(system.initialState, 0.2, output)).toBe(output);
    expect(output.position[0]).toBe(0);
    expect(output.velocity[0]).toBe(0);
    expect(output.position[1]).toBeLessThan(2);
  });

  it('projects hard bounds with configurable restitution', () => {
    const system = createCoupledSpringSystem({
      particles: [
        {
          mass: 1,
          position: 0,
          velocity: 10,
          min: -1,
          max: 1,
          restitution: 0.5,
        },
      ],
      connections: [],
    });
    const state = system.stateAt(0.2);

    expect(state.position[0]).toBeLessThanOrEqual(1);
    expect(state.velocity[0]).toBeLessThan(0);
  });

  it('is deterministic regardless of intermediate sampling', () => {
    const options = {
      particles: [
        { mass: 1, position: 0, velocity: 5 },
        { mass: 1, position: 1, velocity: -5 },
      ],
      connections: [
        { from: 0, to: 1, stiffness: 100, damping: 2, restOffset: 1 },
      ],
    } as const;
    const direct = createCoupledSpringSystem(options);
    const sampled = createCoupledSpringSystem(options);

    for (const time of [0.1, 0.5, 0.02]) sampled.stateAt(time);
    expect(sampled.stateAt(0.3)).toEqual(direct.stateAt(0.3));
  });

  it('validates topology and particle constraints', () => {
    expect(() =>
      createCoupledSpringSystem({ particles: [], connections: [] }),
    ).toThrow(RangeError);
    expect(() =>
      createCoupledSpringSystem({
        particles: [{ mass: 1, position: 0 }],
        connections: [{ from: 0, to: 1, stiffness: 10, damping: 1 }],
      }),
    ).toThrow(RangeError);
    expect(() =>
      createCoupledSpringSystem({
        particles: [{ mass: 1, position: 0, restitution: 2 }],
        connections: [],
      }),
    ).toThrow(RangeError);
  });

  it('rejects explicit null numeric options instead of applying defaults', () => {
    expect(() =>
      createCoupledSpringSystem({
        particles: [{ mass: 1, position: 0 }],
        connections: [],
        maxStep: null as never,
      }),
    ).toThrow(RangeError);
    expect(() =>
      createCoupledSpringSystem({
        particles: [{ mass: 1, position: 0, velocity: null as never }],
        connections: [],
      }),
    ).toThrow(RangeError);
    expect(() =>
      createCoupledSpringSystem({
        particles: [{ mass: 1, position: 0, restitution: null as never }],
        connections: [],
      }),
    ).toThrow(RangeError);
    expect(() =>
      createCoupledSpringSystem({
        particles: [
          { mass: 1, position: 0 },
          { mass: 1, position: 1 },
        ],
        connections: [
          {
            from: 0,
            to: 1,
            stiffness: 1,
            damping: 0,
            restOffset: null as never,
          },
        ],
      }),
    ).toThrow(RangeError);
  });

  it('treats a zero-time advance as an identity without projecting constraints', () => {
    const system = createCoupledSpringSystem({
      particles: [{ mass: 1, position: 0, min: -1, max: 1, restitution: 0.5 }],
      connections: [],
    });
    const state = { position: [2], velocity: [10] };

    expect(system.advance(state, 0)).toEqual(state);
  });

  it('continues to project constraints for a positive-time advance', () => {
    const system = createCoupledSpringSystem({
      particles: [{ mass: 1, position: 0, min: -1, max: 1, restitution: 0.5 }],
      connections: [],
    });

    expect(system.advance({ position: [2], velocity: [10] }, 0.001)).toEqual({
      position: [1],
      velocity: [-5],
    });
  });

  it('rejects impractical integration work and non-finite derived forces', () => {
    const system = createCoupledSpringSystem({
      particles: [{ mass: 1, position: 0 }],
      connections: [],
      maxStep: Number.MIN_VALUE,
    });
    expect(() => system.stateAt(1)).toThrow(/integration steps/);

    const overflowing = createCoupledSpringSystem({
      particles: [
        {
          mass: 1,
          position: Number.MAX_VALUE,
          anchor: {
            target: -Number.MAX_VALUE,
            stiffness: Number.MAX_VALUE,
            damping: 0,
          },
        },
      ],
      connections: [],
    });
    expect(() => overflowing.forceAt(overflowing.initialState)).toThrow(
      /force\[0\] must be a finite number/,
    );
  });
});
