import { assertFinite } from './math.js';
import { getSettlingResult } from './settling.js';
import { createAnalyticalSolver } from './solver.js';
import type {
  SpringInitialState,
  SpringOptions,
  SpringParameters,
  SpringSettleInput,
  SpringSettlingOptions,
  SpringSolution,
  SpringState,
} from './types.js';

const DEFAULT_SETTLE: Readonly<SpringSettleInput> = {
  position: 0.1,
  velocity: 0.1,
};

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
    positionEpsilon: options.settle?.position ?? DEFAULT_SETTLE.position,
    velocityEpsilon: options.settle?.velocity ?? DEFAULT_SETTLE.velocity,
  };
  const solver = createAnalyticalSolver(parameters, initialState);
  const settlingResult = getSettlingResult(solver, settling);

  const stateAt = (time: number): SpringState => solver.stateAt(time);

  return Object.freeze({
    dampingRatio: solver.dampingRatio,
    angularFrequency: solver.angularFrequency,
    regime: solver.regime,
    parameters: Object.freeze(parameters),
    initialState: Object.freeze(initialState),
    settling: Object.freeze(settling),
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
        },
      });
    },
  });
}
