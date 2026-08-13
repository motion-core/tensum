export { createSpring } from './spring.js';
export {
  CRITICAL_DAMPING_TOLERANCE,
  angularFrequency,
  classifyDamping,
  dampingRatio,
} from './math.js';
export { createAnalyticalSolver, validateSpringParameters } from './solver.js';
export {
  DEFAULT_SETTLING_OPTIONS,
  getSettlingResult,
  validateSettlingOptions,
} from './settling.js';
export type {
  SettlingResult,
  SpringInitialState,
  SpringOptions,
  SpringParameters,
  SpringRegime,
  SpringSettleInput,
  SpringSettlingOptions,
  SpringSolution,
  SpringState,
} from './types.js';
