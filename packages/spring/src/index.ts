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
export {
  createMotionSpringTween,
  MotionCoreSpringPlugin,
  MotionCoreSpringPlugin as SpringPlugin,
  registerMotionCoreSpringPlugin,
  registerMotionCoreSpringPlugin as registerSpringPlugin,
} from './gsap/plugin.js';
export type {
  MotionSpringEffectTweenVars,
  MotionSpringEffectVars,
  MotionSpringPluginVars,
} from './gsap/plugin.js';
export { SUPPORTED_PROPERTIES, springTo } from './gsap/spring-to.js';
export type {
  BuiltInSpringProperty,
  SpringController,
  SpringProperty,
  SpringPropertyAdapter,
  SpringPropertyOptions,
  SpringSolutionMap,
  SpringStateMap,
  SpringTargetValue,
  SpringTargets,
  SpringToSnapshot,
  SpringToVars,
  SpringVelocities,
  UnsettledPolicy,
} from './gsap/spring-to.js';
export { createSpringValue } from './support/spring-value.js';
export { createAdditiveSpringValue } from './support/additive-spring-value.js';
export { createSpringKeyframes } from './support/keyframes.js';
export { createInertia, snapToGrid } from './support/inertia.js';
export {
  normalizedVelocity,
  physicalVelocity,
  velocityFromSamples,
} from './support/velocity.js';
export type {
  AdditiveSpringContributionOptions,
  AdditiveSpringEvent,
  AdditiveSpringListener,
  AdditiveSpringOptions,
  AdditiveSpringSnapshot,
  AdditiveSpringValue,
} from './support/additive-spring-value.js';
export type {
  SpringKeyframe,
  SpringKeyframeSegment,
  SpringKeyframeSequence,
  SpringKeyframesOptions,
} from './support/keyframes.js';
export type {
  InertiaBoundaryTransition,
  InertiaOptions,
  InertiaPhase,
  InertiaSolution,
} from './support/inertia.js';
export type {
  FrameDriver,
  SpringValue,
  SpringValueEvent,
  SpringValueListener,
  SpringValueOptions,
  SpringValueRetargetOptions,
  SpringValueSnapshot,
} from './support/spring-value.js';
export type {
  VelocityFromSamplesOptions,
  VelocitySample,
} from './support/velocity.js';
