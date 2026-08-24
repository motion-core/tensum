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
  release(options?: { restore?: boolean }): boolean;
}

interface TrackEntry {
  source: ActiveTrackSource;
}

type PropertyTracks = Map<string, TrackEntry[]>;

const objectTracks = new WeakMap<object, PropertyTracks>();
const primitiveTracks = new Map<unknown, PropertyTracks>();

function isObjectKey(target: unknown): target is object {
  return (
    (typeof target === 'object' && target !== null) ||
    typeof target === 'function'
  );
}

function tracksFor(target: unknown, create: boolean): PropertyTracks | undefined {
  if (isObjectKey(target)) {
    const existing = objectTracks.get(target);
    if (existing || !create) return existing;
    const tracks = new Map<string, TrackEntry[]>();
    objectTracks.set(target, tracks);
    return tracks;
  }

  const existing = primitiveTracks.get(target);
  if (existing || !create) return existing;
  const tracks = new Map<string, TrackEntry[]>();
  primitiveTracks.set(target, tracks);
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
  else primitiveTracks.delete(target);
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
  const entry: TrackEntry = { source };
  let active = false;

  const activate = (): void => {
    if (active) return;
    stackFor(target, property, true)!.push(entry);
    active = true;
  };

  const release = (options: { restore?: boolean } = {}): boolean => {
    if (!active) return false;
    const stack = stackFor(target, property, false);
    if (!stack) {
      active = false;
      return false;
    }
    const index = stack.indexOf(entry);
    if (index < 0) {
      active = false;
      return false;
    }
    const wasOwner = index === stack.length - 1;
    stack.splice(index, 1);
    active = false;
    const previous = wasOwner ? stack.at(-1) : undefined;
    if (previous && options.restore !== false) previous.source.restore();
    cleanup(target, property);
    return previous !== undefined && options.restore !== false;
  };

  activate();
  return Object.freeze({
    isActive(): boolean {
      return active;
    },
    isOwner(): boolean {
      if (!active) return false;
      return stackFor(target, property, false)?.at(-1) === entry;
    },
    activate,
    release,
  });
}
