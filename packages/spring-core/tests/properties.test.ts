import { describe, expect, it } from 'vitest';
import { createSpring } from '../src/index.js';
import type { SpringParameters, SpringSolution } from '../src/index.js';

const PROPERTY_SEED = 0x5a17c0de;
const CASES = 160;

interface GeneratedSpring {
  parameters: SpringParameters;
  distance: number;
  velocity: number;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return (): number => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function logUniform(random: () => number, minimum: number, maximum: number): number {
  return 10 ** (minimum + (maximum - minimum) * random());
}

function signed(random: () => number, value: number): number {
  return random() < 0.5 ? -value : value;
}

function generatedCases(): readonly GeneratedSpring[] {
  const random = mulberry32(PROPERTY_SEED);
  const ratios = [0, 0.01, 0.5, 0.9999999, 1, 1.0000001, 2, 1e4, 1e8];
  return Array.from({ length: CASES }, (_, index) => {
    const mass = logUniform(random, -6, 6);
    const stiffness = logUniform(random, -6, 12);
    const ratio = ratios[index % ratios.length]!;
    const damping = 2 * ratio * Math.sqrt(stiffness) * Math.sqrt(mass);
    return {
      parameters: { mass, stiffness, damping },
      distance: signed(random, logUniform(random, -6, 9)),
      velocity: signed(random, logUniform(random, -6, 9)),
    };
  });
}

function makeSpring(generated: GeneratedSpring): SpringSolution {
  return createSpring({
    from: 0,
    to: generated.distance,
    velocity: generated.velocity,
    ...generated.parameters,
    settle: {
      position: Math.max(1e-12, Math.abs(generated.distance) * 1e-6),
      velocity: Math.max(1e-12, Math.abs(generated.velocity) * 1e-6),
      maxDuration: 1e6,
      refinementIterations: 32,
    },
  });
}

function relativeError(actual: number, expected: number): number {
  return Math.abs(actual - expected) / Math.max(1, Math.abs(actual), Math.abs(expected));
}

function withSeedContext(index: number, assertion: () => void): void {
  try {
    assertion();
  } catch (error) {
    throw new Error(
      `spring property failed with seed 0x${PROPERTY_SEED.toString(16)}, case ${index}`,
      { cause: error },
    );
  }
}

describe('generated spring invariants', () => {
  it('reproduces initial state and produces finite deterministic samples', () => {
    generatedCases().forEach((generated, index) =>
      withSeedContext(index, () => {
        const spring = makeSpring(generated);
        expect(spring.stateAt(0)).toEqual({
          position: 0,
          velocity: generated.velocity,
        });
        const frequency = spring.angularFrequency;
        for (const time of [1e-6 / frequency, 0.1 / frequency, 1 / frequency, 10 / frequency]) {
          const first = spring.stateAt(time);
          spring.stateAt(time / 3);
          const second = spring.stateAt(time);
          expect(second).toEqual(first);
          expect(Number.isFinite(first.position)).toBe(true);
          expect(Number.isFinite(first.velocity)).toBe(true);
        }
      }),
    );
  });

  it('is symmetric when distance and velocity change sign', () => {
    generatedCases().forEach((generated, index) =>
      withSeedContext(index, () => {
        const positive = makeSpring(generated);
        const negative = makeSpring({
          ...generated,
          distance: -generated.distance,
          velocity: -generated.velocity,
        });
        for (const time of [0, 0.1, 1].map((scale) => scale / positive.angularFrequency)) {
          const forward = positive.stateAt(time);
          const mirrored = negative.stateAt(time);
          expect(relativeError(mirrored.position, -forward.position)).toBeLessThan(1e-10);
          expect(relativeError(mirrored.velocity, -forward.velocity)).toBeLessThan(1e-10);
        }
      }),
    );
  });

  it('satisfies the damped oscillator equation numerically', () => {
    generatedCases().forEach((generated, index) =>
      withSeedContext(index, () => {
        const spring = makeSpring(generated);
        const time = 0.75 / spring.angularFrequency;
        const step = Math.max(1e-10, 1e-5 / spring.angularFrequency);
        const state = spring.stateAt(time);
        const acceleration =
          (spring.velocityAt(time + step) - spring.velocityAt(time - step)) /
          (2 * step);
        const residual =
          generated.parameters.mass * acceleration +
          generated.parameters.damping * state.velocity +
          generated.parameters.stiffness * (state.position - generated.distance);
        const scale = Math.max(
          1,
          Math.abs(generated.parameters.mass * acceleration),
          Math.abs(generated.parameters.damping * state.velocity),
          Math.abs(
            generated.parameters.stiffness * (state.position - generated.distance),
          ),
        );
        expect(Math.abs(residual) / scale).toBeLessThan(2e-5);
      }),
    );
  });

  it('does not increase mechanical energy when damping is positive', () => {
    generatedCases()
      .filter(({ parameters }) => parameters.damping > 0)
      .forEach((generated, index) =>
        withSeedContext(index, () => {
          const spring = makeSpring(generated);
          const energyAt = (time: number): number => {
            const state = spring.stateAt(time);
            return (
              (generated.parameters.mass * state.velocity ** 2) / 2 +
              (generated.parameters.stiffness *
                (state.position - generated.distance) ** 2) /
                2
            );
          };
          const first = energyAt(0.1 / spring.angularFrequency);
          const second = energyAt(1 / spring.angularFrequency);
          expect(second).toBeLessThanOrEqual(first * (1 + 1e-10) + 1e-12);
        }),
      );
  });

  it('preserves retarget state and keeps settled future tails inside tolerance', () => {
    generatedCases().forEach((generated, index) =>
      withSeedContext(index, () => {
        const spring = makeSpring(generated);
        const interruptionTime = 0.4 / spring.angularFrequency;
        const interrupted = spring.stateAt(interruptionTime);
        const retargeted = spring.retarget(-generated.distance / 2, interruptionTime);
        expect(retargeted.stateAt(0)).toEqual(interrupted);

        const result = spring.getSettlingResult();
        if (!result.settled) return;
        for (const offset of [0, 0.1, 1, 10].map((scale) => scale / spring.angularFrequency)) {
          const state = spring.stateAt(result.duration + offset);
          expect(Math.abs(state.position - generated.distance)).toBeLessThanOrEqual(
            spring.settling.positionEpsilon * (1 + 1e-10),
          );
          expect(Math.abs(state.velocity)).toBeLessThanOrEqual(
            spring.settling.velocityEpsilon * (1 + 1e-10),
          );
        }
      }),
    );
  });
});
