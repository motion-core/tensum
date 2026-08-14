export { createSpring } from './spring.js';
export { createSpringModel } from './model.js';
export { createVectorSpring } from './vector.js';
export {
  springCharacteristics,
  springParameters,
  springPresets,
} from './parameters.js';
export {
  MOTION_COMPATIBILITY_COMMIT,
  MOTION_COMPATIBILITY_VERSION,
  motionSpringParameters,
} from './motion-compatibility.js';
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
  resolveSettlingOptions,
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
  SpringTiming,
  SpringTimingInput,
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
export type {
  MotionDurationSpringInput,
  MotionSpringParameterConverters,
  MotionVisualDurationSpringInput,
} from './motion-compatibility.js';
export type { SpringModel } from './model.js';
export type {
  MutableVectorSpringState,
  VectorSpringOptions,
  VectorSpringSolution,
  VectorSpringState,
} from './vector.js';
