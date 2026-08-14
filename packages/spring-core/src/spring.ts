import { assertFinite } from './math.js';
import { DEFAULT_SETTLING_OPTIONS, getSettlingResult } from './settling.js';
import { createAnalyticalSolver } from './solver.js';
import type {
  SpringInitialState,
  SpringOptions,
  SpringParameters,
  SpringSettlingOptions,
  SpringSolution,
  SpringState,
  SpringTiming,
} from './types.js';

export function createSpring(options: SpringOptions): SpringSolution {
  const parameters: SpringParameters = {
    mass: options.mass,
    stiffness: options.stiffness,
    damping: options.damping,
  };
  const initialState: SpringInitialState = {
    position: options.from,
    velocity: options.velocity ?? 0,
    target: options.to,
  };
  const settling: SpringSettlingOptions = {
    positionEpsilon:
      options.settle?.position ?? DEFAULT_SETTLING_OPTIONS.positionEpsilon,
    velocityEpsilon:
      options.settle?.velocity ?? DEFAULT_SETTLING_OPTIONS.velocityEpsilon,
    maxDuration: options.settle?.maxDuration ?? DEFAULT_SETTLING_OPTIONS.maxDuration,
    refinementIterations:
      options.settle?.refinementIterations ??
      DEFAULT_SETTLING_OPTIONS.refinementIterations,
  };
  const solver = createAnalyticalSolver(parameters, initialState);
  const settlingResult = getSettlingResult(solver, settling);
  const perceptualDuration =
    options.timing?.perceptualDuration ?? (2 * Math.PI) / solver.angularFrequency;
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
    parameters: Object.freeze(parameters),
    initialState: Object.freeze(initialState),
    settling: Object.freeze(settling),
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
      return createSpring({
        from: current.position,
        to: target,
        velocity: current.velocity,
        ...parameters,
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
