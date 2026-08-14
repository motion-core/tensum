export { createSpring } from './spring.js';
export {
  springCharacteristics,
  springParameters,
  springPresets,
} from './parameters.js';
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
export type {
  PerceptualSpringInput,
  ResponseSpringInput,
  SettlingDurationSpringInput,
  SpringCharacteristics,
  SpringParameterConverters,
  SpringPreset,
  SpringPresetOptions,
  SpringPresets,
  VisualSpringInput,
} from './parameters.js';
