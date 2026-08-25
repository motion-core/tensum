import { createSpring } from '../spring.js';
import type {
  SettlingResult,
  SpringParameters,
  SpringSettleInput,
  SpringSolution,
  SpringState,
  SpringTiming,
  SpringTimingInput,
} from '../types.js';

export interface SpringKeyframe {
  value: number;
  startVelocity?: number;
  parameters?: Partial<SpringParameters>;
  settle?: SpringSettleInput;
  timing?: SpringTimingInput;
}

export interface SpringKeyframesOptions {
  from: number;
  keyframes: readonly SpringKeyframe[];
  parameters: SpringParameters;
  velocity?: number;
  settle?: SpringSettleInput;
  timing?: SpringTimingInput;
}

export interface SpringKeyframeSegment {
  readonly index: number;
  readonly startTime: number;
  readonly endTime: number;
  readonly solution: SpringSolution;
}

export interface SpringKeyframeSequence {
  readonly duration: number;
  readonly settled: boolean;
  readonly timing: Readonly<SpringTiming>;
  readonly segments: readonly Readonly<SpringKeyframeSegment>[];
  positionAt(time: number): number;
  velocityAt(time: number): number;
  stateAt(time: number): SpringState;
  getSettlingResult(): SettlingResult;
}

function assertFinite(name: string, value: number): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${name} must be a finite number`);
  }
}

function assertOptionalObject(name: string, value: unknown): void {
  if (
    value !== undefined &&
    (typeof value !== 'object' || value === null || Array.isArray(value))
  ) {
    throw new TypeError(`${name} must be an object when provided`);
  }
}

export function createSpringKeyframes(
  options: SpringKeyframesOptions,
): SpringKeyframeSequence {
  assertFinite('from', options.from);
  if (options.keyframes.length === 0) {
    throw new RangeError('spring keyframes require at least one destination');
  }

  const segments: SpringKeyframeSegment[] = [];
  let from = options.from;
  let startTime = 0;
  let perceptualDuration = 0;

  if (options.velocity !== undefined) {
    assertFinite('velocity', options.velocity);
  }
  assertOptionalObject('settle', options.settle);
  assertOptionalObject('timing', options.timing);

  for (let index = 0; index < options.keyframes.length; index += 1) {
    const keyframe = options.keyframes[index]!;
    assertFinite(`keyframes[${index}].value`, keyframe.value);
    assertOptionalObject(`keyframes[${index}].parameters`, keyframe.parameters);
    assertOptionalObject(`keyframes[${index}].settle`, keyframe.settle);
    assertOptionalObject(`keyframes[${index}].timing`, keyframe.timing);
    const frameVelocity =
      keyframe.startVelocity === undefined
        ? index === 0
          ? options.velocity === undefined
            ? 0
            : options.velocity
          : 0
        : keyframe.startVelocity;
    assertFinite(`keyframes[${index}].startVelocity`, frameVelocity);
    const parameters: SpringParameters = {
      mass:
        keyframe.parameters?.mass === undefined
          ? options.parameters.mass
          : keyframe.parameters.mass,
      stiffness:
        keyframe.parameters?.stiffness === undefined
          ? options.parameters.stiffness
          : keyframe.parameters.stiffness,
      damping:
        keyframe.parameters?.damping === undefined
          ? options.parameters.damping
          : keyframe.parameters.damping,
    };
    const settle =
      options.settle || keyframe.settle
        ? { ...options.settle, ...keyframe.settle }
        : undefined;
    const timing =
      keyframe.timing === undefined ? options.timing : keyframe.timing;
    const solution = createSpring({
      from,
      to: keyframe.value,
      velocity: frameVelocity,
      ...parameters,
      ...(settle === undefined ? {} : { settle }),
      ...(timing === undefined ? {} : { timing }),
    });
    const result = solution.getSettlingResult();
    if (!result.settled && index < options.keyframes.length - 1) {
      throw new RangeError(
        `keyframes[${index}] is unsettled and cannot define the next segment start`,
      );
    }
    const endTime = startTime + result.duration;
    assertFinite('duration', endTime);
    segments.push(Object.freeze({ index, startTime, endTime, solution }));
    perceptualDuration += solution.timing.perceptualDuration;
    assertFinite('perceptualDuration', perceptualDuration);
    startTime = endTime;
    from = keyframe.value;
  }

  const frozenSegments = Object.freeze(segments);
  const duration = frozenSegments.at(-1)!.endTime;
  const settled = frozenSegments.every((segment) => segment.solution.timing.settled);
  const timing: Readonly<SpringTiming> = Object.freeze({
    perceptualDuration,
    settlingDuration: duration,
    settled,
  });

  const stateAt = (time: number): SpringState => {
    assertFinite('time', time);
    if (time < 0) throw new RangeError('time must be greater than or equal to 0');
    const segment =
      frozenSegments.find((candidate) => time < candidate.endTime) ??
      frozenSegments.at(-1)!;
    const localTime = Math.min(
      Math.max(0, time - segment.startTime),
      segment.solution.getSettlingDuration(),
    );
    if (time >= duration && segment.solution.timing.settled) {
      return { position: segment.solution.initialState.target, velocity: 0 };
    }
    return segment.solution.stateAt(localTime);
  };

  return Object.freeze({
    duration,
    settled,
    timing,
    segments: frozenSegments,
    positionAt(time: number): number {
      return stateAt(time).position;
    },
    velocityAt(time: number): number {
      return stateAt(time).velocity;
    },
    stateAt,
    getSettlingResult(): SettlingResult {
      return {
        duration,
        iterations: frozenSegments.reduce(
          (total, segment) =>
            total + segment.solution.getSettlingResult().iterations,
          0,
        ),
        settled,
      };
    },
  });
}
