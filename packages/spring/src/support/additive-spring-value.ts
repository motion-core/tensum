import { springParameters } from '../parameters.js';
import { resolveSettlingOptions } from '../settling.js';
import { createSpring, resolveSpringTimingInput } from '../spring.js';
import type {
  SpringParameters,
  SpringSettleInput,
  SpringSolution,
  SpringState,
  SpringTimingInput,
} from '../types.js';
import type { FrameDriver } from './spring-value.js';

export interface AdditiveSpringOptions {
  settle?: SpringSettleInput;
  timing?: SpringTimingInput;
}

export interface AdditiveSpringContributionOptions {
  parameters?: SpringParameters;
  settle?: SpringSettleInput;
  timing?: SpringTimingInput;
  velocity?: number;
}

export interface AdditiveSpringSnapshot {
  value: number;
  velocity: number;
  target: number;
  animating: boolean;
  contributions: number;
}

export type AdditiveSpringEvent = 'change' | 'settle' | 'unsettled';
export type AdditiveSpringListener = (
  snapshot: Readonly<AdditiveSpringSnapshot>,
) => void;

export interface AdditiveSpringValue {
  get(): number;
  getVelocity(): number;
  getTarget(): number;
  getSnapshot(): Readonly<AdditiveSpringSnapshot>;
  animateBy(delta: number, options?: AdditiveSpringContributionOptions): number;
  cancel(contribution: number): void;
  jump(value: number): void;
  stop(): void;
  on(event: AdditiveSpringEvent, listener: AdditiveSpringListener): () => void;
  destroy(): void;
}

interface ActiveContribution {
  solution: SpringSolution;
  startedAt: number;
  unsettledNotified: boolean;
}

function assertFinite(name: string, value: number): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${name} must be a finite number`);
  }
}

/**
 * Composes overlapping spring effects as independent additive contributions.
 * Use createSpringValue when each new target should replace the previous one.
 */
export function createAdditiveSpringValue(
  initialValue: number,
  parameters: SpringParameters,
  driver: FrameDriver,
  options: AdditiveSpringOptions = {},
): AdditiveSpringValue {
  assertFinite('initialValue', initialValue);
  const defaultParameters = springParameters.fromPhysics(parameters);
  const defaultSettling = resolveSettlingOptions(options.settle);
  const defaultTiming = resolveSpringTimingInput(options.timing);
  const listeners: Record<AdditiveSpringEvent, Set<AdditiveSpringListener>> = {
    change: new Set(),
    settle: new Set(),
    unsettled: new Set(),
  };
  const contributions = new Map<number, ActiveContribution>();

  let base = initialValue;
  let value = initialValue;
  let velocity = 0;
  let nextId = 1;
  let cancelFrame: (() => void) | undefined;
  let destroyed = false;
  let lastTime = Number.NEGATIVE_INFINITY;
  let revision = 0;

  const aggregateTarget = (): number => {
    let aggregate = base;
    for (const contribution of contributions.values()) {
      aggregate += contribution.solution.initialState.target;
      assertFinite('target', aggregate);
    }
    return aggregate;
  };

  const snapshot = (): Readonly<AdditiveSpringSnapshot> =>
    Object.freeze({
      value,
      velocity,
      target: aggregateTarget(),
      animating: contributions.size > 0,
      contributions: contributions.size,
    });

  const emit = (event: AdditiveSpringEvent): void => {
    if (destroyed || listeners[event].size === 0) return;
    const current = snapshot();
    for (const listener of [...listeners[event]]) listener(current);
  };

  const write = (nextValue: number, nextVelocity: number): void => {
    assertFinite('value', nextValue);
    assertFinite('velocity', nextVelocity);
    const changed =
      !Object.is(value, nextValue) || !Object.is(velocity, nextVelocity);
    value = nextValue;
    velocity = nextVelocity;
    if (changed) emit('change');
  };

  const validateTime = (time: number): void => {
    assertFinite('frame time', time);
    if (time < lastTime) throw new RangeError('frame time must be monotonic');
    lastTime = time;
  };

  const sample = (time: number): void => {
    validateTime(time);
    if (contributions.size === 0) return;
    const sampledRevision = revision;

    let positionSum = 0;
    let velocitySum = 0;
    let nextBase = base;
    const removedIds: number[] = [];
    let removed = false;
    let becameUnsettled = false;
    for (const [id, contribution] of contributions) {
      const elapsed = Math.max(0, time - contribution.startedAt);
      const result = contribution.solution.getSettlingResult();
      if (result.settled && elapsed >= result.duration) {
        nextBase += contribution.solution.initialState.target;
        assertFinite('base', nextBase);
        removedIds.push(id);
        removed = true;
        continue;
      }

      const state = contribution.solution.stateAt(elapsed);
      positionSum += state.position;
      velocitySum += state.velocity;
      assertFinite('position sum', positionSum);
      assertFinite('velocity sum', velocitySum);
      if (
        !result.settled &&
        !contribution.unsettledNotified &&
        elapsed >= result.duration
      ) {
        contribution.unsettledNotified = true;
        becameUnsettled = true;
      }
    }

    const nextValue = nextBase + positionSum;
    assertFinite('value', nextValue);
    base = nextBase;
    for (const id of removedIds) contributions.delete(id);
    write(nextValue, velocitySum);
    if (revision !== sampledRevision) return;
    if (becameUnsettled) {
      emit('unsettled');
      if (revision !== sampledRevision) return;
    }
    if (removed && contributions.size === 0) emit('settle');
  };

  let requestFrame: () => void;
  const frame = (time: number): void => {
    cancelFrame = undefined;
    if (destroyed) return;
    sample(time);
    if (contributions.size > 0) requestFrame();
  };

  requestFrame = (): void => {
    if (destroyed || cancelFrame || contributions.size === 0) return;
    cancelFrame = driver.schedule(frame);
  };

  const sampleNow = (): number => {
    const time = driver.now();
    sample(time);
    return time;
  };

  const clearAtCurrentValue = (): void => {
    base = value;
    contributions.clear();
    cancelFrame?.();
    cancelFrame = undefined;
    write(base, 0);
  };

  return Object.freeze({
    get(): number {
      return value;
    },
    getVelocity(): number {
      return velocity;
    },
    getTarget(): number {
      return snapshot().target;
    },
    getSnapshot: snapshot,
    animateBy(
      delta: number,
      contributionOptions: AdditiveSpringContributionOptions = {},
    ): number {
      if (destroyed) throw new Error('additive spring value has been destroyed');
      assertFinite('delta', delta);
      const initialVelocity =
        contributionOptions.velocity === undefined
          ? 0
          : contributionOptions.velocity;
      assertFinite('velocity', initialVelocity);
      const contributionParameters = springParameters.fromPhysics(
        contributionOptions.parameters === undefined
          ? defaultParameters
          : contributionOptions.parameters,
      );
      if (contributionOptions.settle !== undefined) {
        resolveSettlingOptions(contributionOptions.settle);
      }
      const settle = {
        position: defaultSettling.positionEpsilon,
        velocity: defaultSettling.velocityEpsilon,
        maxDuration: defaultSettling.maxDuration,
        refinementIterations: defaultSettling.refinementIterations,
        ...contributionOptions.settle,
      };
      const timing =
        contributionOptions.timing === undefined
          ? defaultTiming
          : resolveSpringTimingInput(contributionOptions.timing);
      const time = sampleNow();
      assertFinite('target', aggregateTarget() + delta);
      const solution = createSpring({
        from: 0,
        to: delta,
        velocity: initialVelocity,
        ...contributionParameters,
        settle,
        ...(timing === undefined ? {} : { timing }),
      });
      const id = nextId;
      nextId += 1;
      revision += 1;

      if (delta === 0 && initialVelocity === 0) {
        if (contributions.size === 0) emit('settle');
        return id;
      }
      contributions.set(id, {
        solution,
        startedAt: time,
        unsettledNotified: false,
      });
      requestFrame();
      return id;
    },
    cancel(contributionId: number): void {
      if (destroyed) return;
      if (!Number.isInteger(contributionId) || contributionId <= 0) {
        throw new RangeError('contribution must be a positive integer');
      }
      const time = sampleNow();
      const contribution = contributions.get(contributionId);
      if (!contribution) return;
      revision += 1;
      const currentRevision = revision;
      const state: SpringState = contribution.solution.stateAt(
        Math.max(0, time - contribution.startedAt),
      );
      const nextBase = base + state.position;
      const nextVelocity = velocity - state.velocity;
      assertFinite('base', nextBase);
      assertFinite('velocity', nextVelocity);
      base = nextBase;
      contributions.delete(contributionId);
      write(value, nextVelocity);
      if (revision !== currentRevision) return;
      if (contributions.size === 0) {
        cancelFrame?.();
        cancelFrame = undefined;
        emit('settle');
      }
    },
    jump(nextValue: number): void {
      if (destroyed) return;
      assertFinite('value', nextValue);
      const changed = !Object.is(value, nextValue) || velocity !== 0;
      revision += 1;
      const currentRevision = revision;
      base = nextValue;
      contributions.clear();
      cancelFrame?.();
      cancelFrame = undefined;
      write(nextValue, 0);
      if (revision !== currentRevision) return;
      if (changed) emit('settle');
    },
    stop(): void {
      if (destroyed || contributions.size === 0) return;
      sampleNow();
      if (contributions.size === 0) return;
      revision += 1;
      const currentRevision = revision;
      clearAtCurrentValue();
      if (revision !== currentRevision) return;
      emit('settle');
    },
    on(event: AdditiveSpringEvent, listener: AdditiveSpringListener): () => void {
      if (destroyed) return () => undefined;
      listeners[event].add(listener);
      return () => listeners[event].delete(listener);
    },
    destroy(): void {
      if (destroyed) return;
      revision += 1;
      destroyed = true;
      clearAtCurrentValue();
      for (const eventListeners of Object.values(listeners)) {
        eventListeners.clear();
      }
    },
  });
}
