import type { SpringState } from '../types.js';

export interface ActiveTrackState extends SpringState {
  unit?: string;
}

export interface ActiveTrackHandoffState extends ActiveTrackState {
  terminal?: true;
}

export interface ActiveTrackSource {
  state(globalTime?: number): ActiveTrackState;
  restore(): void;
}

export interface ActiveTrackRegistration {
  isActive(): boolean;
  isOwner(): boolean;
  activate(): void;
  /**
   * Marks a normally completed track as terminal. A terminal owner remains as
   * the handoff baseline while covered historical tracks are discarded.
   */
  retire(): boolean;
  release(options?: { restore?: boolean }): boolean;
}

interface TrackEntry {
  active: boolean;
  discarded: boolean;
  order: number;
  source: ActiveTrackSource;
  terminal: boolean;
}

type PropertyTracks = Map<string, TrackEntry[]>;

const objectTracks = new WeakMap<object, PropertyTracks>();
let nextTrackOrder = 0;

function isObjectKey(target: unknown): target is object {
  return (
    (typeof target === 'object' && target !== null) ||
    typeof target === 'function'
  );
}

function tracksFor(
  target: unknown,
  create: boolean,
): PropertyTracks | undefined {
  if (!isObjectKey(target)) {
    if (create) {
      throw new TypeError('active spring tracks require an object target');
    }
    return undefined;
  }

  const existing = objectTracks.get(target);
  if (existing || !create) return existing;
  const tracks = new Map<string, TrackEntry[]>();
  objectTracks.set(target, tracks);
  return tracks;
}

function stackFor(
  target: unknown,
  property: string,
  create: boolean,
): TrackEntry[] | undefined {
  const tracks = tracksFor(target, create);
  if (!tracks) return undefined;
  const existing = tracks.get(property);
  if (existing || !create) return existing;
  const stack: TrackEntry[] = [];
  tracks.set(property, stack);
  return stack;
}

function cleanup(target: unknown, property: string): void {
  const tracks = tracksFor(target, false);
  if (!tracks) return;
  const stack = tracks.get(property);
  if (stack?.length === 0) tracks.delete(property);
  if (tracks.size !== 0) return;
  if (isObjectKey(target)) objectTracks.delete(target);
}

export function activeTrackState(
  target: unknown,
  property: string,
  globalTime?: number,
): ActiveTrackHandoffState | undefined {
  const owner = stackFor(target, property, false)?.at(-1);
  if (!owner) return undefined;
  return {
    ...owner.source.state(globalTime),
    ...(owner.terminal ? { terminal: true as const } : {}),
  };
}

/**
 * Invalidates a terminal handoff baseline after an external write. The whole
 * property history is discarded so reversing an older tween cannot restore a
 * value that no longer represents the target.
 */
function discardTerminalTrackHistory(
  target: unknown,
  property: string,
): boolean {
  const stack = stackFor(target, property, false);
  if (!stack?.at(-1)?.terminal) return false;
  for (const entry of stack) {
    entry.active = false;
    entry.discarded = true;
    entry.terminal = false;
  }
  stack.length = 0;
  cleanup(target, property);
  return true;
}

function positionsMatch(first: number, second: number): boolean {
  const floatingPointTolerance =
    Number.EPSILON * Math.max(1, Math.abs(first), Math.abs(second)) * 8;
  return Math.abs(first - second) <= Math.max(1e-9, floatingPointTolerance);
}

/**
 * Preserves a live/unchanged handoff, but atomically invalidates terminal
 * history when the target was externally changed after completion.
 */
export function reconcileActiveTrackHandoff(
  target: unknown,
  property: string,
  inherited: ActiveTrackHandoffState | undefined,
  actualPosition: number,
): ActiveTrackHandoffState | undefined {
  if (
    !inherited?.terminal ||
    positionsMatch(inherited.position, actualPosition)
  ) {
    return inherited;
  }
  discardTerminalTrackHistory(target, property);
  return undefined;
}

export function registerActiveTrack(
  target: unknown,
  property: string,
  source: ActiveTrackSource,
): ActiveTrackRegistration {
  const entry: TrackEntry = {
    active: false,
    discarded: false,
    order: nextTrackOrder++,
    source,
    terminal: false,
  };

  const activate = (): void => {
    if (entry.active || entry.discarded) return;
    const stack = stackFor(target, property, true)!;
    const nextIndex = stack.findIndex(
      (candidate) => candidate.order > entry.order,
    );
    if (nextIndex < 0) stack.push(entry);
    else stack.splice(nextIndex, 0, entry);
    entry.active = true;
  };

  const release = (options: { restore?: boolean } = {}): boolean => {
    if (!entry.active) return false;
    const stack = stackFor(target, property, false);
    if (!stack) {
      entry.active = false;
      entry.terminal = false;
      return false;
    }
    const index = stack.indexOf(entry);
    if (index < 0) {
      entry.active = false;
      entry.terminal = false;
      return false;
    }
    const wasOwner = index === stack.length - 1;
    stack.splice(index, 1);
    entry.active = false;
    entry.terminal = false;
    const previous = wasOwner ? stack.at(-1) : undefined;
    if (previous && options.restore !== false) previous.source.restore();
    cleanup(target, property);
    return previous !== undefined && options.restore !== false;
  };

  const retire = (): boolean => {
    if (!entry.active || entry.discarded) return false;
    const stack = stackFor(target, property, false);
    if (!stack) {
      entry.active = false;
      entry.terminal = false;
      return false;
    }
    const index = stack.indexOf(entry);
    if (index < 0) {
      entry.active = false;
      entry.terminal = false;
      return false;
    }

    if (index === stack.length - 1) {
      const covered = stack.splice(0, index);
      for (const candidate of covered) {
        candidate.active = false;
        candidate.terminal = false;
      }
      entry.terminal = true;
      return true;
    }

    stack.splice(index, 1);
    entry.active = false;
    entry.terminal = false;
    cleanup(target, property);
    return true;
  };

  activate();
  return Object.freeze({
    isActive(): boolean {
      return entry.active;
    },
    isOwner(): boolean {
      if (!entry.active) return false;
      return stackFor(target, property, false)?.at(-1) === entry;
    },
    activate,
    retire,
    release,
  });
}
