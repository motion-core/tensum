import { describe, expect, it } from 'vitest';
import { createSpring, createVectorSpring } from '../src/index.js';
import type { SpringParameters } from '../src/index.js';

const parameters = { mass: 1, stiffness: 180, damping: 24 } as const;

describe('vector spring composition', () => {
  it('matches independent scalar springs component by component', () => {
    const vector = createVectorSpring({
      from: [0, -20],
      to: [500, 200],
      velocity: [1200, -300],
      parameters,
    });
    const scalars = [
      createSpring({ from: 0, to: 500, velocity: 1200, ...parameters }),
      createSpring({ from: -20, to: 200, velocity: -300, ...parameters }),
    ];

    for (const time of [0, 0.1, 0.5, 1]) {
      const state = vector.stateAt(time);
      for (let index = 0; index < scalars.length; index += 1) {
        expect(state.position[index]).toBe(scalars[index]!.positionAt(time));
        expect(state.velocity[index]).toBe(scalars[index]!.velocityAt(time));
      }
    }
  });

  it('settles only after every component meets its own tolerance', () => {
    const vector = createVectorSpring({
      from: [0, 1],
      to: [500, 1.2],
      parameters,
      settle: [
        { position: 0.1, velocity: 0.1 },
        { position: 0.001, velocity: 0.001 },
      ],
    });

    expect(vector.getSettlingDuration()).toBe(
      Math.max(...vector.springs.map((spring) => spring.getSettlingDuration())),
    );
    expect(vector.getSettlingResult().settled).toBe(true);
    expect(vector.timing.settlingDuration).toBe(vector.getSettlingDuration());
  });

  it('writes into caller-owned buffers without replacing them', () => {
    const vector = createVectorSpring({
      from: [0, 0],
      to: [100, 200],
      parameters,
    });
    const output = { position: [0, 0], velocity: [0, 0] };

    expect(vector.stateAtInto(0.25, output)).toBe(output);
    expect(output.position).toEqual(vector.positionAt(0.25));
    expect(output.velocity).toEqual(vector.velocityAt(0.25));
  });

  it('preserves every component position and velocity when retargeted', () => {
    const vector = createVectorSpring({
      from: [0, 0],
      to: [500, 200],
      velocity: [1200, -300],
      parameters,
    });
    const interruptionTime = 0.23;
    const before = vector.stateAt(interruptionTime);
    const retargeted = vector.retarget([100, 400], interruptionTime);

    expect(retargeted.positionAt(0)).toEqual(before.position);
    expect(retargeted.velocityAt(0)).toEqual(before.velocity);
  });

  it('propagates non-settlement from any component', () => {
    const vector = createVectorSpring({
      from: [0, 0],
      to: [100, 200],
      parameters: { ...parameters, damping: 0 },
      settle: { maxDuration: 2 },
    });

    expect(vector.getSettlingResult()).toMatchObject({
      settled: false,
      duration: 2,
    });
  });

  it('rejects empty or mismatched vectors and undersized output buffers', () => {
    expect(() => createVectorSpring({ from: [], to: [], parameters })).toThrow(
      RangeError,
    );
    expect(() =>
      createVectorSpring({ from: [0, 0], to: [1], parameters }),
    ).toThrow(RangeError);

    const vector = createVectorSpring({ from: [0, 0], to: [1, 1], parameters });
    expect(() =>
      vector.stateAtInto(0, { position: [0], velocity: [0] }),
    ).toThrow(RangeError);
  });

  it('rejects an explicit null velocity instead of treating it as omitted', () => {
    expect(() =>
      createVectorSpring({
        from: [0],
        to: [1],
        velocity: null as never,
        parameters,
      }),
    ).toThrow(TypeError);
  });

  it('retargets with the parameter and timing snapshot captured at construction', () => {
    const mutableParameters: SpringParameters = { ...parameters };
    const mutableTiming = { perceptualDuration: 0.4 };
    const from = [0, 20];
    const to = [100, 200];
    const velocity = [10, -20];
    const vector = createVectorSpring({
      from,
      to,
      velocity,
      parameters: mutableParameters,
      timing: mutableTiming,
    });

    from[0] = 5_000;
    to[0] = -5_000;
    velocity[0] = 9_000;
    mutableParameters.stiffness = 1;
    mutableTiming.perceptualDuration = 9;

    const retargeted = vector.retarget([300, 400], 0.2);
    expect(retargeted.springs[0]!.parameters).toEqual(parameters);
    expect(retargeted.timing.perceptualDuration).toBe(0.4);
  });
});
