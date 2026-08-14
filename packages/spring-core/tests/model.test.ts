import { describe, expect, it } from 'vitest';
import { createSpring, createSpringModel } from '../src/index.js';
import type { SpringState } from '../src/index.js';

const parameters = { mass: 1, stiffness: 100, damping: 12 } as const;
const initial = { position: -40, velocity: 75, target: 120 } as const;

describe('SpringModel', () => {
  it('exposes frozen parameters and characteristics', () => {
    const model = createSpringModel(parameters);

    expect(model.parameters).toEqual(parameters);
    expect(Object.isFrozen(model)).toBe(true);
    expect(Object.isFrozen(model.parameters)).toBe(true);
    expect(Object.isFrozen(model.characteristics)).toBe(true);
  });

  it('computes force with the physical sign and damping contribution', () => {
    const model = createSpringModel(parameters);

    expect(model.force({ position: 10, velocity: 0 }, 0)).toBe(-1000);
    expect(model.force({ position: -10, velocity: 0 }, 0)).toBe(1000);
    expect(model.force({ position: 10, velocity: 5 }, 0)).toBe(-1060);
  });

  it('samples the same analytical solution as createSpring', () => {
    const model = createSpringModel(parameters);
    const spring = createSpring({
      from: initial.position,
      to: initial.target,
      velocity: initial.velocity,
      ...parameters,
    });

    for (const time of [0, 0.01, 0.2, 0.8, 2]) {
      expect(model.stateAt(initial, time)).toEqual(spring.stateAt(time));
    }
  });

  it('advances without frame-rate drift', () => {
    const model = createSpringModel(parameters);
    let stepped: SpringState = {
      position: initial.position,
      velocity: initial.velocity,
    };

    for (let step = 0; step < 100; step += 1) {
      stepped = model.advance(stepped, initial.target, 0.01);
    }

    const direct = model.stateAt(initial, 1);
    expect(stepped.position).toBeCloseTo(direct.position, 10);
    expect(stepped.velocity).toBeCloseTo(direct.velocity, 10);
  });

  it('shares settling and solve semantics with SpringSolution', () => {
    const model = createSpringModel(parameters);
    const settle = {
      position: 0.02,
      velocity: 0.03,
      maxDuration: 8,
      refinementIterations: 24,
    } as const;
    const solution = model.solve(initial, { settle });

    expect(model.settling(initial, settle)).toEqual(solution.getSettlingResult());
    expect(solution.initialState).toEqual(initial);
    expect(solution.parameters).toEqual(parameters);
  });

  it('rejects non-finite force results', () => {
    const model = createSpringModel({
      mass: 1,
      stiffness: Number.MAX_VALUE,
      damping: 1,
    });

    expect(() =>
      model.force({ position: Number.MAX_VALUE, velocity: 0 }, 0),
    ).toThrow(RangeError);
  });
});
