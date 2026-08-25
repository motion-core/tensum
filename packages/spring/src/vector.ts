import { assertFinite } from './math.js';
import { createSpring } from './spring.js';
import type {
  SettlingResult,
  SpringParameters,
  SpringSettleInput,
  SpringSolution,
  SpringState,
  SpringTiming,
  SpringTimingInput,
} from './types.js';

export interface VectorSpringOptions {
  from: readonly number[];
  to: readonly number[];
  velocity?: readonly number[];
  parameters: SpringParameters;
  settle?: SpringSettleInput | readonly SpringSettleInput[];
  timing?: SpringTimingInput;
}

export interface VectorSpringState {
  position: readonly number[];
  velocity: readonly number[];
}

export interface MutableVectorSpringState {
  position: number[];
  velocity: number[];
}

export interface VectorSpringSolution {
  readonly dimension: number;
  readonly springs: readonly SpringSolution[];
  readonly timing: Readonly<SpringTiming>;
  readonly settlingResults: readonly Readonly<SettlingResult>[];
  positionAt(time: number): readonly number[];
  velocityAt(time: number): readonly number[];
  stateAt(time: number): VectorSpringState;
  stateAtInto(time: number, output: MutableVectorSpringState): MutableVectorSpringState;
  getSettlingDuration(): number;
  getSettlingResult(): SettlingResult;
  retarget(target: readonly number[], time: number): VectorSpringSolution;
}

function assertDimension(
  name: string,
  value: readonly number[],
  dimension: number,
): void {
  if (value.length !== dimension) {
    throw new RangeError(`${name} must contain exactly ${dimension} components`);
  }
  for (let index = 0; index < value.length; index += 1) {
    assertFinite(`${name}[${index}]`, value[index]!);
  }
}

function settleFor(
  settle: VectorSpringOptions['settle'],
  index: number,
): SpringSettleInput | undefined {
  if (Array.isArray(settle)) {
    return (settle as readonly SpringSettleInput[])[index];
  }
  return settle as SpringSettleInput | undefined;
}

function resolvedSettleFor(spring: SpringSolution): SpringSettleInput {
  return {
    position: spring.settling.positionEpsilon,
    velocity: spring.settling.velocityEpsilon,
    maxDuration: spring.settling.maxDuration,
    refinementIterations: spring.settling.refinementIterations,
  };
}

export function createVectorSpring(
  options: VectorSpringOptions,
): VectorSpringSolution {
  const dimension = options.from.length;
  if (dimension === 0) {
    throw new RangeError('vector springs require at least one component');
  }
  assertDimension('from', options.from, dimension);
  assertDimension('to', options.to, dimension);
  if (options.velocity !== undefined) {
    assertDimension('velocity', options.velocity, dimension);
  }
  if (Array.isArray(options.settle) && options.settle.length !== dimension) {
    throw new RangeError(`settle must contain exactly ${dimension} component options`);
  }

  const springs = Object.freeze(
    Array.from({ length: dimension }, (_, index) => {
      const settle = settleFor(options.settle, index);
      return createSpring({
        from: options.from[index]!,
        to: options.to[index]!,
        velocity:
          options.velocity === undefined ? 0 : options.velocity[index]!,
        ...options.parameters,
        ...(settle === undefined ? {} : { settle }),
        ...(options.timing === undefined ? {} : { timing: options.timing }),
      });
    }),
  );
  const settlingResults = Object.freeze(
    springs.map((spring) => Object.freeze(spring.getSettlingResult())),
  );
  const parameterSnapshot = springs[0]!.parameters;
  const timingSnapshot: Readonly<SpringTimingInput> = Object.freeze({
    perceptualDuration: springs[0]!.timing.perceptualDuration,
  });
  const duration = Math.max(...settlingResults.map((result) => result.duration));
  const settled = settlingResults.every((result) => result.settled);
  const timing: Readonly<SpringTiming> = Object.freeze({
    perceptualDuration: Math.max(
      ...springs.map((spring) => spring.timing.perceptualDuration),
    ),
    settlingDuration: duration,
    settled,
  });

  const stateAtInto = (
    time: number,
    output: MutableVectorSpringState,
  ): MutableVectorSpringState => {
    if (output.position.length < dimension || output.velocity.length < dimension) {
      throw new RangeError(`output buffers must contain at least ${dimension} components`);
    }
    for (let index = 0; index < dimension; index += 1) {
      const state: SpringState = springs[index]!.stateAt(time);
      output.position[index] = state.position;
      output.velocity[index] = state.velocity;
    }
    return output;
  };

  return Object.freeze({
    dimension,
    springs,
    timing,
    settlingResults,
    positionAt(time: number): readonly number[] {
      return Object.freeze(springs.map((spring) => spring.positionAt(time)));
    },
    velocityAt(time: number): readonly number[] {
      return Object.freeze(springs.map((spring) => spring.velocityAt(time)));
    },
    stateAt(time: number): VectorSpringState {
      const output = stateAtInto(time, {
        position: Array<number>(dimension),
        velocity: Array<number>(dimension),
      });
      return Object.freeze({
        position: Object.freeze(output.position),
        velocity: Object.freeze(output.velocity),
      });
    },
    stateAtInto,
    getSettlingDuration(): number {
      return duration;
    },
    getSettlingResult(): SettlingResult {
      return {
        duration,
        iterations: settlingResults.reduce(
          (total, result) => total + result.iterations,
          0,
        ),
        settled,
      };
    },
    retarget(target: readonly number[], time: number): VectorSpringSolution {
      assertDimension('target', target, dimension);
      const current = stateAtInto(time, {
        position: Array<number>(dimension),
        velocity: Array<number>(dimension),
      });
      return createVectorSpring({
        from: current.position,
        to: target,
        velocity: current.velocity,
        parameters: parameterSnapshot,
        settle: springs.map(resolvedSettleFor),
        timing: timingSnapshot,
      });
    },
  });
}
