import {
  createSpring,
  resolveSettlingOptions,
} from '@motion-core/spring';
import type {
  SettlingResult,
  SpringParameters,
  SpringSettleInput,
  SpringSolution,
  SpringState,
} from '@motion-core/spring';

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

export function snapToGrid(size: number, origin = 0): (target: number) => number {
  assertPositive('grid size', size);
  assertFinite('grid origin', origin);
  return (target: number): number => {
    assertFinite('target', target);
    return origin + Math.round((target - origin) / size) * size;
  };
}

export function createInertia(options: InertiaOptions): InertiaSolution {
  assertFinite('from', options.from);
  assertFinite('velocity', options.velocity);
  const timeConstant = options.timeConstant ?? 0.7;
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
  const naturalTarget = options.from + options.velocity * timeConstant;
  assertFinite('naturalTarget', naturalTarget);
  const target = options.modifyTarget?.(naturalTarget) ?? naturalTarget;
  assertFinite('modified target', target);
  const displacement = options.from - target;
  const linearCoefficient = options.velocity + displacement / timeConstant;

  const decayStateAt = (time: number): SpringState => {
    if (time === 0) return { position: options.from, velocity: options.velocity };
    const decay = Math.exp(-time / timeConstant);
    const offset = displacement + linearCoefficient * time;
    return {
      position: target + decay * offset,
      velocity:
        decay *
        (linearCoefficient - offset / timeConstant),
    };
  };

  const decayBoundsAt = (time: number): SpringState => {
    const decay = Math.exp(-time / timeConstant);
    return {
      position:
        decay * (Math.abs(displacement) + Math.abs(linearCoefficient) * time),
      velocity:
        decay *
        (Math.abs(linearCoefficient - displacement / timeConstant) +
          (Math.abs(linearCoefficient) * time) / timeConstant),
    };
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
    let lower = Math.min(timeConstant, settling.maxDuration);
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
          const midpoint = (lower + upper) / 2;
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

  const outsideAtStart =
    options.min !== undefined && options.from < options.min
      ? options.min
      : options.max !== undefined && options.from > options.max
        ? options.max
        : undefined;

  const findBoundary = (): { time: number; bound: number } | undefined => {
    if (outsideAtStart !== undefined) return { time: 0, bound: outsideAtStart };
    if (options.min === undefined && options.max === undefined) return undefined;
    const step = Math.min(timeConstant / 16, 1 / 120);
    let previousTime = 0;
    for (
      let time = step;
      time <= decayResult.duration + step / 2;
      time += step
    ) {
      const sampledTime = Math.min(time, decayResult.duration);
      const position = decayStateAt(sampledTime).position;
      const bound =
        options.min !== undefined && position <= options.min
          ? options.min
          : options.max !== undefined && position >= options.max
            ? options.max
            : undefined;
      if (bound !== undefined) {
        let lower = previousTime;
        let upper = sampledTime;
        for (let iteration = 0; iteration < 48; iteration += 1) {
          const midpoint = (lower + upper) / 2;
          const midpointPosition = decayStateAt(midpoint).position;
          const crossed = bound === options.min
            ? midpointPosition <= bound
            : midpointPosition >= bound;
          if (crossed) upper = midpoint;
          else lower = midpoint;
        }
        return { time: upper, bound };
      }
      previousTime = sampledTime;
      if (sampledTime === decayResult.duration) break;
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
