import { resolveSettlingOptions } from '../settling.js';
import { createSpring } from '../spring.js';
import { validateSpringParameters } from '../solver.js';
import type {
  SettlingResult,
  SpringParameters,
  SpringSettleInput,
  SpringSolution,
  SpringState,
} from '../types.js';

const DEFAULT_BOUNDARY_SPRING: Readonly<SpringParameters> = Object.freeze({
  mass: 1,
  stiffness: 500,
  damping: 40,
});

export interface InertiaOptions {
  from: number;
  velocity: number;
  timeConstant?: number;
  min?: number;
  max?: number;
  modifyTarget?: (naturalTarget: number) => number;
  boundarySpring?: SpringParameters;
  settle?: SpringSettleInput;
}

export interface InertiaBoundaryTransition {
  readonly time: number;
  readonly bound: number;
  readonly incomingVelocity: number;
  readonly spring: SpringSolution;
}

export type InertiaPhase = 'decay' | 'spring' | 'complete';

export interface InertiaSolution {
  readonly initialState: Readonly<SpringState>;
  readonly naturalTarget: number;
  readonly target: number;
  readonly duration: number;
  readonly settled: boolean;
  readonly boundary?: Readonly<InertiaBoundaryTransition>;
  stateAt(time: number): SpringState;
  positionAt(time: number): number;
  velocityAt(time: number): number;
  phaseAt(time: number): InertiaPhase;
  getSettlingResult(): SettlingResult;
}

function assertFinite(name: string, value: number): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${name} must be a finite number`);
  }
}

function assertPositive(name: string, value: number): void {
  assertFinite(name, value);
  if (value <= 0) throw new RangeError(`${name} must be greater than 0`);
}

function finiteState(
  position: number,
  velocity: number,
  suffix = '',
): SpringState {
  assertFinite(`position${suffix}`, position);
  assertFinite(`velocity${suffix}`, velocity);
  return { position, velocity };
}

export function snapToGrid(size: number, origin = 0): (target: number) => number {
  assertPositive('grid size', size);
  assertFinite('grid origin', origin);
  return (target: number): number => {
    assertFinite('target', target);
    const result = origin + Math.round((target - origin) / size) * size;
    assertFinite('snapped target', result);
    return result;
  };
}

export function createInertia(options: InertiaOptions): InertiaSolution {
  assertFinite('from', options.from);
  assertFinite('velocity', options.velocity);
  const timeConstant =
    options.timeConstant === undefined ? 0.7 : options.timeConstant;
  assertPositive('timeConstant', timeConstant);
  if (options.min !== undefined) assertFinite('min', options.min);
  if (options.max !== undefined) assertFinite('max', options.max);
  if (
    options.min !== undefined &&
    options.max !== undefined &&
    options.min > options.max
  ) {
    throw new RangeError('min must be less than or equal to max');
  }

  const settling = resolveSettlingOptions(options.settle);
  if (options.boundarySpring !== undefined) {
    validateSpringParameters(options.boundarySpring);
  }
  const naturalTarget = options.from + options.velocity * timeConstant;
  assertFinite('naturalTarget', naturalTarget);
  const target =
    options.modifyTarget === undefined
      ? naturalTarget
      : options.modifyTarget(naturalTarget);
  assertFinite('modified target', target);
  const displacement = options.from - target;
  assertFinite('displacement', displacement);
  const linearCoefficient = options.velocity + displacement / timeConstant;
  assertFinite('linear coefficient', linearCoefficient);

  const decayStateAt = (time: number): SpringState => {
    if (time === 0) return { position: options.from, velocity: options.velocity };
    const decay = Math.exp(-time / timeConstant);
    if (decay === 0) return { position: target, velocity: 0 };
    const timeDecay = time * decay;
    return finiteState(
      target + decay * displacement + timeDecay * linearCoefficient,
      decay * options.velocity -
        (timeDecay / timeConstant) * linearCoefficient,
    );
  };

  const decayBoundsAt = (time: number): SpringState => {
    const decay = Math.exp(-time / timeConstant);
    if (decay === 0) return { position: 0, velocity: 0 };
    const timeDecay = time * decay;
    return finiteState(
      decay * Math.abs(displacement) +
        timeDecay * Math.abs(linearCoefficient),
      decay * Math.abs(options.velocity) +
        (timeDecay / timeConstant) * Math.abs(linearCoefficient),
      ' bound',
    );
  };

  const boundsMeet = (time: number): boolean => {
    const bounds = decayBoundsAt(time);
    return (
      bounds.position <= settling.positionEpsilon &&
      bounds.velocity <= settling.velocityEpsilon
    );
  };

  let decayIterations = 0;
  let decayResult: SettlingResult;
  if (displacement === 0 && options.velocity === 0) {
    decayResult = { duration: 0, iterations: 0, settled: true };
  } else {
    const absoluteLinearCoefficient = Math.abs(linearCoefficient);
    const positionMonotonicAfter =
      absoluteLinearCoefficient === 0
        ? 0
        : Math.max(
            0,
            timeConstant - Math.abs(displacement) / absoluteLinearCoefficient,
          );
    const velocityMonotonicAfter =
      absoluteLinearCoefficient === 0
        ? 0
        : Math.max(
            0,
            timeConstant -
              (Math.abs(options.velocity) * timeConstant) /
                absoluteLinearCoefficient,
          );
    const boundsMonotonicAfter = Math.max(
      positionMonotonicAfter,
      velocityMonotonicAfter,
    );
    if (boundsMonotonicAfter > settling.maxDuration) {
      decayResult = {
        duration: settling.maxDuration,
        iterations: 0,
        settled: false,
      };
    } else if (boundsMeet(0) && boundsMonotonicAfter === 0) {
      decayResult = { duration: 0, iterations: 0, settled: true };
    } else {
      let lower = boundsMonotonicAfter;
      let upper = Math.max(lower, Math.min(settling.maxDuration, 1 / 120));
      if (boundsMeet(lower)) {
        decayResult = { duration: lower, iterations: 0, settled: true };
      } else {
        while (upper < settling.maxDuration && !boundsMeet(upper)) {
          lower = upper;
          upper = Math.min(settling.maxDuration, upper * 2);
          decayIterations += 1;
        }
        if (!boundsMeet(upper)) {
          decayResult = {
            duration: settling.maxDuration,
            iterations: decayIterations,
            settled: false,
          };
        } else {
          for (
            let iteration = 0;
            iteration < settling.refinementIterations;
            iteration += 1
          ) {
            const midpoint = lower + (upper - lower) / 2;
            if (midpoint === lower || midpoint === upper) break;
            if (boundsMeet(midpoint)) upper = midpoint;
            else lower = midpoint;
            decayIterations += 1;
          }
          decayResult = {
            duration: upper,
            iterations: decayIterations,
            settled: true,
          };
        }
      }
    }
  }

  const outsideAtStart =
    options.min !== undefined && options.from < options.min
      ? options.min
      : options.max !== undefined && options.from > options.max
        ? options.max
        : options.min !== undefined &&
            options.from === options.min &&
            options.velocity < 0
          ? options.min
          : options.max !== undefined &&
              options.from === options.max &&
              options.velocity > 0
            ? options.max
            : undefined;

  const findBoundary = (): { time: number; bound: number } | undefined => {
    if (outsideAtStart !== undefined) return { time: 0, bound: outsideAtStart };
    if (options.min === undefined && options.max === undefined) return undefined;
    const extremumTime =
      linearCoefficient === 0
        ? undefined
        : (options.velocity * timeConstant) / linearCoefficient;
    const boundaries = [
      0,
      ...(extremumTime !== undefined &&
      extremumTime > 0 &&
      extremumTime < decayResult.duration
        ? [extremumTime]
        : []),
      decayResult.duration,
    ];

    for (let index = 1; index < boundaries.length; index += 1) {
      const startTime = boundaries[index - 1]!;
      const endTime = boundaries[index]!;
      const startPosition = decayStateAt(startTime).position;
      const endPosition = decayStateAt(endTime).position;
      const increasing = endPosition >= startPosition;
      const bound = increasing
        ? options.max !== undefined &&
          startPosition <= options.max &&
          endPosition >= options.max
          ? options.max
          : undefined
        : options.min !== undefined &&
            startPosition >= options.min &&
            endPosition <= options.min
          ? options.min
          : undefined;
      if (bound === undefined) continue;

      let lower = startTime;
      let upper = endTime;
      for (let iteration = 0; iteration < 48; iteration += 1) {
        const midpoint = lower + (upper - lower) / 2;
        const position = decayStateAt(midpoint).position;
        const crossed = increasing ? position >= bound : position <= bound;
        if (crossed) upper = midpoint;
        else lower = midpoint;
      }
      return { time: upper, bound };
    }
    return undefined;
  };

  const hit = findBoundary();
  let boundary: Readonly<InertiaBoundaryTransition> | undefined;
  let duration = decayResult.duration;
  let settled = decayResult.settled;
  let iterations = decayResult.iterations;

  if (hit) {
    const hitState =
      hit.time === 0
        ? { position: options.from, velocity: options.velocity }
        : decayStateAt(hit.time);
    const spring = createSpring({
      from: hitState.position,
      to: hit.bound,
      velocity: hitState.velocity,
      ...(options.boundarySpring ?? DEFAULT_BOUNDARY_SPRING),
      settle: {
        position: settling.positionEpsilon,
        velocity: settling.velocityEpsilon,
        maxDuration: settling.maxDuration,
        refinementIterations: settling.refinementIterations,
      },
    });
    const springResult = spring.getSettlingResult();
    boundary = Object.freeze({
      time: hit.time,
      bound: hit.bound,
      incomingVelocity: hitState.velocity,
      spring,
    });
    duration = hit.time + springResult.duration;
    assertFinite('duration', duration);
    settled = springResult.settled;
    iterations += springResult.iterations;
  }

  const stateAt = (time: number): SpringState => {
    assertFinite('time', time);
    if (time < 0) throw new RangeError('time must be greater than or equal to 0');
    if (settled && time >= duration) {
      return { position: boundary?.bound ?? target, velocity: 0 };
    }
    if (boundary && time >= boundary.time) {
      return boundary.spring.stateAt(
        Math.min(time - boundary.time, boundary.spring.getSettlingDuration()),
      );
    }
    return decayStateAt(Math.min(time, decayResult.duration));
  };

  const phaseAt = (time: number): InertiaPhase => {
    assertFinite('time', time);
    if (time < 0) throw new RangeError('time must be greater than or equal to 0');
    if (settled && time >= duration) return 'complete';
    if (boundary && time >= boundary.time) return 'spring';
    return 'decay';
  };

  return Object.freeze({
    initialState: Object.freeze({
      position: options.from,
      velocity: options.velocity,
    }),
    naturalTarget,
    target: boundary?.bound ?? target,
    duration,
    settled,
    ...(boundary === undefined ? {} : { boundary }),
    stateAt,
    positionAt(time: number): number {
      return stateAt(time).position;
    },
    velocityAt(time: number): number {
      return stateAt(time).velocity;
    },
    phaseAt,
    getSettlingResult(): SettlingResult {
      return { duration, iterations, settled };
    },
  });
}
