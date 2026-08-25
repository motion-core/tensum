import { assertFinite } from './math.js';
import { springCharacteristics } from './parameters.js';
import { getSettlingResult, resolveSettlingOptions } from './settling.js';
import { createAnalyticalSolver, validateInitialState } from './solver.js';
import {
  createSpringSolution,
  type SpringSolutionOptions,
} from './spring.js';
import type { SpringCharacteristics } from './parameters.js';
import type {
  SettlingResult,
  SpringInitialState,
  SpringParameters,
  SpringSettleInput,
  SpringSolution,
  SpringState,
} from './types.js';

export interface SpringModel {
  readonly parameters: Readonly<SpringParameters>;
  readonly characteristics: Readonly<SpringCharacteristics>;
  force(state: SpringState, target: number): number;
  stateAt(initial: SpringInitialState, time: number): SpringState;
  advance(state: SpringState, target: number, deltaTime: number): SpringState;
  settling(initial: SpringInitialState, options?: SpringSettleInput): SettlingResult;
  solve(initial: SpringInitialState, options?: SpringSolutionOptions): SpringSolution;
}

export function createSpringModel(parameters: SpringParameters): SpringModel {
  const characteristics = springCharacteristics(parameters);
  const canonicalParameters: Readonly<SpringParameters> = Object.freeze({
    mass: parameters.mass,
    stiffness: parameters.stiffness,
    damping: parameters.damping,
  });

  return Object.freeze({
    parameters: canonicalParameters,
    characteristics,
    force(state: SpringState, target: number): number {
      validateInitialState({ ...state, target });
      const force =
        -canonicalParameters.stiffness * (state.position - target) -
        canonicalParameters.damping * state.velocity;
      assertFinite('force', force);
      return force;
    },
    stateAt(initial: SpringInitialState, time: number): SpringState {
      return createAnalyticalSolver(canonicalParameters, initial).stateAt(time);
    },
    advance(state: SpringState, target: number, deltaTime: number): SpringState {
      return createAnalyticalSolver(canonicalParameters, { ...state, target }).stateAt(
        deltaTime,
      );
    },
    settling(
      initial: SpringInitialState,
      options?: SpringSettleInput,
    ): SettlingResult {
      const solver = createAnalyticalSolver(canonicalParameters, initial);
      return getSettlingResult(solver, resolveSettlingOptions(options));
    },
    solve(
      initial: SpringInitialState,
      options?: SpringSolutionOptions,
    ): SpringSolution {
      return createSpringSolution(canonicalParameters, initial, options);
    },
  });
}
