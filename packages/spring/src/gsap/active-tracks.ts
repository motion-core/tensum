import type { SpringState } from '../types.js';

export interface ActiveTrackState extends SpringState {
  unit?: string;
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
  order: number;
  source: ActiveTrackSource;
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
): ActiveTrackState | undefined {
  const owner = stackFor(target, property, false)?.at(-1);
  if (!owner) return undefined;
  return { ...owner.source.state(globalTime) };
}

export function registerActiveTrack(
  target: unknown,
  property: string,
  source: ActiveTrackSource,
): ActiveTrackRegistration {
  const entry: TrackEntry = {
    active: false,
    order: nextTrackOrder++,
    source,
  };

  const activate = (): void => {
    if (entry.active) return;
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
      return false;
    }
    const index = stack.indexOf(entry);
    if (index < 0) {
      entry.active = false;
      return false;
    }
    const wasOwner = index === stack.length - 1;
    stack.splice(index, 1);
    entry.active = false;
    const previous = wasOwner ? stack.at(-1) : undefined;
    if (previous && options.restore !== false) previous.source.restore();
    cleanup(target, property);
    return previous !== undefined && options.restore !== false;
  };

  const retire = (): boolean => {
    if (!entry.active) return false;
    const stack = stackFor(target, property, false);
    if (!stack) {
      entry.active = false;
      return false;
    }
    const index = stack.indexOf(entry);
    if (index < 0) {
      entry.active = false;
      return false;
    }

    if (index === stack.length - 1) {
      const covered = stack.splice(0, index);
      for (const candidate of covered) candidate.active = false;
      return true;
    }

    stack.splice(index, 1);
    entry.active = false;
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
