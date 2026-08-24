import { springParameters } from '../parameters.js';
import { resolveSettlingOptions } from '../settling.js';
import { createSpring } from '../spring.js';
import type {
  SpringParameters,
  SpringSettleInput,
  SpringSolution,
  SpringState,
  SpringTimingInput,
} from '../types.js';

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

export interface SpringValueRetargetOptions {
  parameters?: SpringParameters;
  blendDuration?: number;
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
  getParameters(): Readonly<SpringParameters>;
  getSnapshot(): Readonly<SpringValueSnapshot>;
  setTarget(target: number, options?: SpringValueRetargetOptions): void;
  setParameters(
    parameters: SpringParameters,
    options?: Pick<SpringValueRetargetOptions, 'blendDuration'>,
  ): void;
  jump(value: number): void;
  stop(): void;
  on(event: SpringValueEvent, listener: SpringValueListener): () => void;
  destroy(): void;
}

interface ActiveSpring {
  solution: SpringSolution;
  blendFrom?: SpringSolution;
  blendDuration: number;
  logicalDuration: number;
  settlingBoundary: number;
  startedAt: number;
  logicalComplete: boolean;
  unsettledNotified: boolean;
}

interface PendingSpringRequest {
  target: number;
  parameters: Readonly<SpringParameters>;
  blendDuration: number;
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
  let currentParameters = springParameters.fromPhysics(parameters);
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
  let pending: PendingSpringRequest | undefined;
  let active: ActiveSpring | undefined;
  let cancelFrame: (() => void) | undefined;
  let destroyed = false;
  let lastFrameTime = Number.NEGATIVE_INFINITY;
  let revision = 0;

  const snapshot = (): Readonly<SpringValueSnapshot> =>
    Object.freeze({
      value,
      velocity,
      target: pending?.target ?? target,
      animating: active !== undefined || pending !== undefined,
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

  const stateAt = (sampled: ActiveSpring, elapsed: number): SpringState => {
    const next = sampled.solution.stateAt(elapsed);
    if (!sampled.blendFrom || elapsed >= sampled.blendDuration) return next;

    const previous = sampled.blendFrom.stateAt(elapsed);
    const progress = elapsed / sampled.blendDuration;
    const weight = progress * progress * (3 - 2 * progress);
    const weightVelocity =
      (6 * progress * (1 - progress)) / sampled.blendDuration;
    return {
      position: previous.position + (next.position - previous.position) * weight,
      velocity:
        previous.velocity +
        (next.velocity - previous.velocity) * weight +
        (next.position - previous.position) * weightVelocity,
    };
  };

  const sampleActive = (time: number): void => {
    if (!active) return;
    const sampled = active;
    const sampledRevision = revision;
    const elapsed = Math.max(0, time - sampled.startedAt);
    const { solution } = sampled;

    if (solution.timing.settled && elapsed >= sampled.settlingBoundary) {
      active = undefined;
      write(solution.initialState.target, 0);
      if (revision !== sampledRevision) return;
      if (
        !sampled.logicalComplete &&
        elapsed >= sampled.logicalDuration
      ) {
        sampled.logicalComplete = true;
        emit('logicalComplete');
        if (revision !== sampledRevision) return;
      }
      emit('settle');
      return;
    }

    const state = stateAt(sampled, elapsed);
    write(state.position, state.velocity);
    if (revision !== sampledRevision || active !== sampled) return;

    if (
      !sampled.logicalComplete &&
      elapsed >= sampled.logicalDuration
    ) {
      sampled.logicalComplete = true;
      emit('logicalComplete');
      if (revision !== sampledRevision || active !== sampled) return;
    }
    if (
      !solution.timing.settled &&
      !sampled.unsettledNotified &&
      elapsed >= sampled.settlingBoundary
    ) {
      sampled.unsettledNotified = true;
      emit('unsettled');
    }
  };

  const createActiveSpring = (
    time: number,
    request: PendingSpringRequest,
    previousParameters: Readonly<SpringParameters>,
  ): void => {
    target = request.target;
    currentParameters = request.parameters;
    if (Object.is(value, target) && velocity === 0) {
      active = undefined;
      emit('settle');
      return;
    }

    const solution = createSpring({
      from: value,
      to: target,
      velocity,
      ...currentParameters,
      settle: settleInput,
      ...(timingInput === undefined ? {} : { timing: timingInput }),
    });
    const parametersChanged =
      previousParameters.mass !== currentParameters.mass ||
      previousParameters.stiffness !== currentParameters.stiffness ||
      previousParameters.damping !== currentParameters.damping;
    const blendFrom =
      request.blendDuration > 0 && parametersChanged
        ? createSpring({
            from: value,
            to: target,
            velocity,
            ...previousParameters,
            settle: settleInput,
            ...(timingInput === undefined ? {} : { timing: timingInput }),
          })
        : undefined;
    active = {
      solution,
      ...(blendFrom === undefined ? {} : { blendFrom }),
      blendDuration: blendFrom ? request.blendDuration : 0,
      logicalDuration: Math.max(
        solution.timing.perceptualDuration,
        blendFrom ? request.blendDuration : 0,
      ),
      settlingBoundary: Math.max(
        solution.timing.settlingDuration,
        blendFrom ? request.blendDuration : 0,
      ),
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

    if (pending !== undefined) {
      // Sample the interrupted trajectory at the exact retarget time before
      // replacing it, preserving analytical rather than frame-difference velocity.
      sampleActive(time);
      const request = pending;
      const previousParameters = currentParameters;
      pending = undefined;
      createActiveSpring(time, request, previousParameters);
    } else {
      sampleActive(time);
    }

    if (active || pending !== undefined) requestFrame();
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
    pending = undefined;
    cancelFrame?.();
    cancelFrame = undefined;
    write(value, 0);
    target = value;
  };

  const queueTarget = (
    nextTarget: number,
    retargetOptions: SpringValueRetargetOptions = {},
  ): void => {
    if (destroyed) return;
    assertFinite('target', nextTarget);
    const nextParameters = retargetOptions.parameters
      ? springParameters.fromPhysics(retargetOptions.parameters)
      : pending?.parameters ?? currentParameters;
    const blendDuration =
      retargetOptions.blendDuration ?? pending?.blendDuration ?? 0;
    assertFinite('blendDuration', blendDuration);
    if (blendDuration < 0) {
      throw new RangeError('blendDuration must be greater than or equal to 0');
    }
    const currentRequestTarget = pending?.target ?? target;
    const currentRequestParameters = pending?.parameters ?? currentParameters;
    const sameParameters =
      currentRequestParameters.mass === nextParameters.mass &&
      currentRequestParameters.stiffness === nextParameters.stiffness &&
      currentRequestParameters.damping === nextParameters.damping;
    if (Object.is(nextTarget, currentRequestTarget) && sameParameters) return;
    revision += 1;
    pending = { target: nextTarget, parameters: nextParameters, blendDuration };
    requestFrame();
  };

  return Object.freeze({
    get(): number {
      return value;
    },
    getVelocity(): number {
      return velocity;
    },
    getTarget(): number {
      return pending?.target ?? target;
    },
    getParameters(): Readonly<SpringParameters> {
      return pending?.parameters ?? currentParameters;
    },
    getSnapshot(): Readonly<SpringValueSnapshot> {
      return snapshot();
    },
    setTarget(
      nextTarget: number,
      retargetOptions: SpringValueRetargetOptions = {},
    ): void {
      queueTarget(nextTarget, retargetOptions);
    },
    setParameters(
      nextParameters: SpringParameters,
      retargetOptions: Pick<SpringValueRetargetOptions, 'blendDuration'> = {},
    ): void {
      if (destroyed) return;
      queueTarget(pending?.target ?? target, {
        parameters: nextParameters,
        ...(retargetOptions.blendDuration === undefined
          ? {}
          : { blendDuration: retargetOptions.blendDuration }),
      });
    },
    jump(nextValue: number): void {
      if (destroyed) return;
      assertFinite('value', nextValue);
      revision += 1;
      active = undefined;
      pending = undefined;
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
