import {
  createSpring,
  resolveSettlingOptions,
  springParameters,
} from '@motion-core/spring';
import type {
  SpringParameters,
  SpringSettleInput,
  SpringSolution,
  SpringTimingInput,
} from '@motion-core/spring';

export interface FrameDriver {
  /** Monotonic time in seconds. */
  now(): number;
  /** Schedule one frame. The callback receives monotonic time in seconds. */
  schedule(callback: (time: number) => void): () => void;
}

export interface SpringValueOptions {
  settle?: SpringSettleInput;
  timing?: SpringTimingInput;
}

export interface SpringValueSnapshot {
  value: number;
  velocity: number;
  target: number;
  animating: boolean;
}

export type SpringValueEvent =
  | 'change'
  | 'logicalComplete'
  | 'settle'
  | 'unsettled';

export type SpringValueListener = (snapshot: Readonly<SpringValueSnapshot>) => void;

export interface SpringValue {
  get(): number;
  getVelocity(): number;
  getTarget(): number;
  getSnapshot(): Readonly<SpringValueSnapshot>;
  setTarget(target: number): void;
  jump(value: number): void;
  stop(): void;
  on(event: SpringValueEvent, listener: SpringValueListener): () => void;
  destroy(): void;
}

interface ActiveSpring {
  solution: SpringSolution;
  startedAt: number;
  logicalComplete: boolean;
  unsettledNotified: boolean;
}

function assertFinite(name: string, value: number): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${name} must be a finite number`);
  }
}

export function createSpringValue(
  initialValue: number,
  parameters: SpringParameters,
  driver: FrameDriver,
  options: SpringValueOptions = {},
): SpringValue {
  assertFinite('initialValue', initialValue);
  const canonicalParameters = springParameters.fromPhysics(parameters);
  const settling = resolveSettlingOptions(options.settle);
  const settleInput: SpringSettleInput = {
    position: settling.positionEpsilon,
    velocity: settling.velocityEpsilon,
    maxDuration: settling.maxDuration,
    refinementIterations: settling.refinementIterations,
  };
  const timingInput =
    options.timing?.perceptualDuration === undefined
      ? undefined
      : Object.freeze({ perceptualDuration: options.timing.perceptualDuration });
  const listeners: Record<SpringValueEvent, Set<SpringValueListener>> = {
    change: new Set(),
    logicalComplete: new Set(),
    settle: new Set(),
    unsettled: new Set(),
  };

  let value = initialValue;
  let velocity = 0;
  let target = initialValue;
  let pendingTarget: number | undefined;
  let active: ActiveSpring | undefined;
  let cancelFrame: (() => void) | undefined;
  let destroyed = false;
  let lastFrameTime = Number.NEGATIVE_INFINITY;
  let revision = 0;

  const snapshot = (): Readonly<SpringValueSnapshot> =>
    Object.freeze({
      value,
      velocity,
      target: pendingTarget ?? target,
      animating: active !== undefined || pendingTarget !== undefined,
    });

  const emit = (event: SpringValueEvent): void => {
    if (destroyed || listeners[event].size === 0) return;
    const current = snapshot();
    for (const listener of [...listeners[event]]) listener(current);
  };

  const write = (nextValue: number, nextVelocity: number): void => {
    const changed = !Object.is(value, nextValue) || !Object.is(velocity, nextVelocity);
    value = nextValue;
    velocity = nextVelocity;
    if (changed) emit('change');
  };

  const sampleActive = (time: number): void => {
    if (!active) return;
    const sampled = active;
    const sampledRevision = revision;
    const elapsed = Math.max(0, time - sampled.startedAt);
    const { solution } = sampled;

    if (solution.timing.settled && elapsed >= solution.timing.settlingDuration) {
      active = undefined;
      write(solution.initialState.target, 0);
      if (revision !== sampledRevision) return;
      if (
        !sampled.logicalComplete &&
        elapsed >= solution.timing.perceptualDuration
      ) {
        sampled.logicalComplete = true;
        emit('logicalComplete');
        if (revision !== sampledRevision) return;
      }
      emit('settle');
      return;
    }

    const state = solution.stateAt(elapsed);
    write(state.position, state.velocity);
    if (revision !== sampledRevision || active !== sampled) return;

    if (
      !sampled.logicalComplete &&
      elapsed >= solution.timing.perceptualDuration
    ) {
      sampled.logicalComplete = true;
      emit('logicalComplete');
      if (revision !== sampledRevision || active !== sampled) return;
    }
    if (
      !solution.timing.settled &&
      !sampled.unsettledNotified &&
      elapsed >= solution.timing.settlingDuration
    ) {
      sampled.unsettledNotified = true;
      emit('unsettled');
    }
  };

  const createActiveSpring = (time: number, nextTarget: number): void => {
    target = nextTarget;
    if (Object.is(value, target) && velocity === 0) {
      active = undefined;
      emit('settle');
      return;
    }

    const solution = createSpring({
      from: value,
      to: target,
      velocity,
      ...canonicalParameters,
      settle: settleInput,
      ...(timingInput === undefined ? {} : { timing: timingInput }),
    });
    active = {
      solution,
      startedAt: time,
      logicalComplete: false,
      unsettledNotified: false,
    };
  };

  const validateFrameTime = (time: number): void => {
    assertFinite('frame time', time);
    if (time < lastFrameTime) {
      throw new RangeError('frame time must be monotonic');
    }
    lastFrameTime = time;
  };

  let requestFrame: () => void;
  const frame = (time: number): void => {
    cancelFrame = undefined;
    if (destroyed) return;
    validateFrameTime(time);

    if (pendingTarget !== undefined) {
      // Sample the interrupted trajectory at the exact retarget time before
      // replacing it, preserving analytical rather than frame-difference velocity.
      sampleActive(time);
      const nextTarget = pendingTarget;
      pendingTarget = undefined;
      createActiveSpring(time, nextTarget);
    } else {
      sampleActive(time);
    }

    if (active || pendingTarget !== undefined) requestFrame();
  };

  requestFrame = (): void => {
    if (destroyed || cancelFrame) return;
    cancelFrame = driver.schedule(frame);
  };

  const stopAt = (time: number): void => {
    revision += 1;
    validateFrameTime(time);
    sampleActive(time);
    active = undefined;
    pendingTarget = undefined;
    cancelFrame?.();
    cancelFrame = undefined;
    write(value, 0);
    target = value;
  };

  return Object.freeze({
    get(): number {
      return value;
    },
    getVelocity(): number {
      return velocity;
    },
    getTarget(): number {
      return pendingTarget ?? target;
    },
    getSnapshot(): Readonly<SpringValueSnapshot> {
      return snapshot();
    },
    setTarget(nextTarget: number): void {
      if (destroyed) return;
      assertFinite('target', nextTarget);
      if (Object.is(nextTarget, pendingTarget ?? target)) return;
      revision += 1;
      pendingTarget = nextTarget;
      requestFrame();
    },
    jump(nextValue: number): void {
      if (destroyed) return;
      assertFinite('value', nextValue);
      revision += 1;
      active = undefined;
      pendingTarget = undefined;
      target = nextValue;
      cancelFrame?.();
      cancelFrame = undefined;
      write(nextValue, 0);
    },
    stop(): void {
      if (destroyed) return;
      stopAt(driver.now());
    },
    on(event: SpringValueEvent, listener: SpringValueListener): () => void {
      if (destroyed) return (): void => {};
      listeners[event].add(listener);
      let subscribed = true;
      return (): void => {
        if (!subscribed) return;
        subscribed = false;
        listeners[event].delete(listener);
      };
    },
    destroy(): void {
      if (destroyed) return;
      stopAt(driver.now());
      destroyed = true;
      for (const eventListeners of Object.values(listeners)) eventListeners.clear();
    },
  });
}
