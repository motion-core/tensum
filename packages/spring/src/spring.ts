import { assertFinite } from './math.js';
import { getSettlingResult, resolveSettlingOptions } from './settling.js';
import { createAnalyticalSolver } from './solver.js';
import type {
  SpringInitialState,
  SpringOptions,
  SpringParameters,
  SpringSettleInput,
  SpringSolution,
  SpringState,
  SpringTiming,
  SpringTimingInput,
} from './types.js';

export interface SpringSolutionOptions {
  settle?: SpringSettleInput;
  timing?: SpringTimingInput;
}

export function resolveSpringTimingInput(
  input: SpringTimingInput | undefined,
): Readonly<SpringTimingInput> | undefined {
  if (input === undefined) return undefined;
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new TypeError('timing must be an object when provided');
  }
  if (input.perceptualDuration === undefined) return Object.freeze({});
  assertFinite('perceptualDuration', input.perceptualDuration);
  if (input.perceptualDuration < 0) {
    throw new RangeError('perceptualDuration must be greater than or equal to 0');
  }
  return Object.freeze({ perceptualDuration: input.perceptualDuration });
}

export function createSpringSolution(
  parameters: SpringParameters,
  initialState: SpringInitialState,
  options: SpringSolutionOptions = {},
): SpringSolution {
  const resolvedTiming = resolveSpringTimingInput(options.timing);
  const settling = resolveSettlingOptions(options.settle);
  const solver = createAnalyticalSolver(parameters, initialState);
  const settlingResult = getSettlingResult(solver, settling);
  const requestedPerceptualDuration = resolvedTiming?.perceptualDuration;
  const perceptualDuration =
    requestedPerceptualDuration === undefined
      ? (2 * Math.PI) / solver.angularFrequency
      : requestedPerceptualDuration;
  assertFinite('perceptualDuration', perceptualDuration);
  if (perceptualDuration < 0) {
    throw new RangeError('perceptualDuration must be greater than or equal to 0');
  }
  const timing: SpringTiming = {
    perceptualDuration,
    settlingDuration: settlingResult.duration,
    settled: settlingResult.settled,
  };

  const stateAt = (time: number): SpringState => solver.stateAt(time);

  return Object.freeze({
    dampingRatio: solver.dampingRatio,
    angularFrequency: solver.angularFrequency,
    regime: solver.regime,
    parameters: Object.freeze({ ...parameters }),
    initialState: Object.freeze({ ...initialState }),
    settling,
    timing: Object.freeze(timing),
    positionAt(time: number) {
      return stateAt(time).position;
    },
    velocityAt(time: number) {
      return stateAt(time).velocity;
    },
    stateAt,
    getSettlingDuration() {
      return settlingResult.duration;
    },
    getSettlingResult() {
      return { ...settlingResult };
    },
    retarget(target: number, time: number) {
      assertFinite('target', target);
      const current = stateAt(time);
      return createSpringSolution(parameters, {
        position: current.position,
        velocity: current.velocity,
        target,
      }, {
        settle: {
          position: settling.positionEpsilon,
          velocity: settling.velocityEpsilon,
          maxDuration: settling.maxDuration,
          refinementIterations: settling.refinementIterations,
        },
        timing: { perceptualDuration: timing.perceptualDuration },
      });
    },
  });
}

export function createSpring(options: SpringOptions): SpringSolution {
  return createSpringSolution(
    {
      mass: options.mass,
      stiffness: options.stiffness,
      damping: options.damping,
    },
    {
      position: options.from,
      velocity: options.velocity === undefined ? 0 : options.velocity,
      target: options.to,
    },
    {
      ...(options.settle === undefined ? {} : { settle: options.settle }),
      ...(options.timing === undefined ? {} : { timing: options.timing }),
    },
  );
}
