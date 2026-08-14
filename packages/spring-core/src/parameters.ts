import {
  angularFrequency,
  assertFinite,
  classifyDamping,
  dampingRatio,
} from './math.js';
import { validateSpringParameters } from './solver.js';
import type { SpringParameters, SpringRegime } from './types.js';

const DEFAULT_MASS = 1;
const TWO_PI = 2 * Math.PI;

export interface ResponseSpringInput {
  response: number;
  dampingRatio: number;
  mass?: number;
}

export interface PerceptualSpringInput {
  duration: number;
  bounce: number;
  mass?: number;
}

export interface VisualSpringInput {
  visualDuration: number;
  bounce: number;
  mass?: number;
}

export interface SettlingDurationSpringInput {
  duration: number;
  dampingRatio: number;
  epsilon: number;
  mass?: number;
}

export interface SpringCharacteristics {
  angularFrequency: number;
  dampingRatio: number;
  regime: SpringRegime;
  response: number;
  bounce: number;
  perceptualDuration: number;
}

export interface SpringParameterConverters {
  fromPhysics(parameters: SpringParameters): Readonly<SpringParameters>;
  fromResponse(input: ResponseSpringInput): Readonly<SpringParameters>;
  fromPerceptualDuration(input: PerceptualSpringInput): Readonly<SpringParameters>;
  fromSettlingDuration(input: SettlingDurationSpringInput): Readonly<SpringParameters>;
  fromVisualDuration(input: VisualSpringInput): Readonly<SpringParameters>;
}

export interface SpringPresetOptions {
  duration?: number;
  extraBounce?: number;
  mass?: number;
}

export type SpringPreset = (
  options?: SpringPresetOptions,
) => Readonly<SpringParameters>;

export interface SpringPresets {
  smooth: SpringPreset;
  snappy: SpringPreset;
  bouncy: SpringPreset;
}

function assertPositive(name: string, value: number): void {
  assertFinite(name, value);
  if (value <= 0) throw new RangeError(`${name} must be greater than 0`);
}

function assertNonNegative(name: string, value: number): void {
  assertFinite(name, value);
  if (value < 0) throw new RangeError(`${name} must be greater than or equal to 0`);
}

function resolvedMass(mass: number | undefined): number {
  const value = mass ?? DEFAULT_MASS;
  assertPositive('mass', value);
  return value;
}

function freezeParameters(parameters: SpringParameters): Readonly<SpringParameters> {
  validateSpringParameters(parameters);
  const frequency = angularFrequency(parameters);
  const ratio = dampingRatio(parameters);
  assertPositive('angularFrequency', frequency);
  assertFinite('dampingRatio', ratio);
  return Object.freeze({ ...parameters });
}

function fromFrequency(
  frequency: number,
  ratio: number,
  mass: number,
): Readonly<SpringParameters> {
  assertPositive('angularFrequency', frequency);
  assertNonNegative('dampingRatio', ratio);
  const stiffness = mass * frequency * frequency;
  const damping = 2 * ratio * mass * frequency;
  return freezeParameters({ mass, stiffness, damping });
}

function bounceToDampingRatio(bounce: number): number {
  assertFinite('bounce', bounce);
  if (bounce <= -1) {
    throw new RangeError('bounce must be greater than -1 for finite spring parameters');
  }
  if (bounce >= 0) return 1 - Math.min(bounce, 1);
  return 1 / (1 + bounce);
}

function dampingRatioToBounce(ratio: number): number {
  return ratio <= 1 ? 1 - ratio : 1 / ratio - 1;
}

export function springCharacteristics(
  parameters: SpringParameters,
): Readonly<SpringCharacteristics> {
  validateSpringParameters(parameters);
  const frequency = angularFrequency(parameters);
  const ratio = dampingRatio(parameters);
  assertPositive('angularFrequency', frequency);
  assertFinite('dampingRatio', ratio);
  const response = TWO_PI / frequency;
  assertPositive('response', response);

  return Object.freeze({
    angularFrequency: frequency,
    dampingRatio: ratio,
    regime: classifyDamping(ratio),
    response,
    bounce: dampingRatioToBounce(ratio),
    perceptualDuration: response,
  });
}

export const springParameters: SpringParameterConverters = Object.freeze({
  fromPhysics(parameters: SpringParameters): Readonly<SpringParameters> {
    return freezeParameters({
      mass: parameters.mass,
      stiffness: parameters.stiffness,
      damping: parameters.damping,
    });
  },
  fromResponse({
    response,
    dampingRatio: ratio,
    mass,
  }: ResponseSpringInput): Readonly<SpringParameters> {
    assertPositive('response', response);
    return fromFrequency(TWO_PI / response, ratio, resolvedMass(mass));
  },
  fromPerceptualDuration({
    duration,
    bounce,
    mass,
  }: PerceptualSpringInput): Readonly<SpringParameters> {
    assertPositive('duration', duration);
    return fromFrequency(
      TWO_PI / duration,
      bounceToDampingRatio(bounce),
      resolvedMass(mass),
    );
  },
  fromSettlingDuration({
    duration,
    dampingRatio: ratio,
    epsilon,
    mass,
  }: SettlingDurationSpringInput): Readonly<SpringParameters> {
    assertPositive('duration', duration);
    assertPositive('dampingRatio', ratio);
    assertFinite('epsilon', epsilon);
    if (epsilon <= 0 || epsilon >= 1) {
      throw new RangeError('epsilon must be greater than 0 and less than 1');
    }
    const frequency = -Math.log(epsilon) / (ratio * duration);
    return fromFrequency(frequency, ratio, resolvedMass(mass));
  },
  fromVisualDuration({
    visualDuration,
    bounce,
    mass,
  }: VisualSpringInput): Readonly<SpringParameters> {
    return springParameters.fromPerceptualDuration({
      duration: visualDuration,
      bounce,
      ...(mass === undefined ? {} : { mass }),
    });
  },
});

function createPreset(baseBounce: number): SpringPreset {
  return (options: SpringPresetOptions = {}): Readonly<SpringParameters> =>
    springParameters.fromPerceptualDuration({
      duration: options.duration ?? 0.5,
      bounce: baseBounce + (options.extraBounce ?? 0),
      ...(options.mass === undefined ? {} : { mass: options.mass }),
    });
}

export const springPresets: SpringPresets = Object.freeze({
  smooth: createPreset(0),
  snappy: createPreset(0.15),
  bouncy: createPreset(0.3),
});
