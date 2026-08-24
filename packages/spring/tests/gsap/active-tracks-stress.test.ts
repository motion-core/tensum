import { describe, expect, it } from 'vitest';
import {
  activeTrackState,
  reconcileActiveTrackHandoff,
  registerActiveTrack,
} from '../../src/gsap/active-tracks.js';
import type { ActiveTrackRegistration } from '../../src/gsap/active-tracks.js';

interface ModelEntry {
  active: boolean;
  readonly order: number;
  readonly registration: ActiveTrackRegistration;
}

function randomSequence(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return state >>> 0;
  };
}

describe('active spring track registry stress', () => {
  it('marks terminal state and atomically discards it after an external write', () => {
    const target = {};
    const older = registerActiveTrack(target, 'x', {
      state: () => ({ position: 25, velocity: 5, unit: 'px' }),
      restore: () => {
        throw new Error('discard must not restore covered history');
      },
    });
    const registration = registerActiveTrack(target, 'x', {
      state: () => ({ position: 100, velocity: 0, unit: 'px' }),
      restore: () => {
        throw new Error('discard must not restore stale terminal history');
      },
    });
    registration.retire();
    older.activate();
    expect(older.isActive()).toBe(true);
    expect(older.isOwner()).toBe(false);

    const terminal = activeTrackState(target, 'x');
    expect(terminal).toEqual({
      position: 100,
      velocity: 0,
      unit: 'px',
      terminal: true,
    });
    expect(reconcileActiveTrackHandoff(target, 'x', terminal, 100)).toBe(
      terminal,
    );
    expect(registration.isOwner()).toBe(true);

    expect(
      reconcileActiveTrackHandoff(target, 'x', terminal, -250),
    ).toBeUndefined();
    expect(registration.isActive()).toBe(false);
    expect(older.isActive()).toBe(false);
    expect(activeTrackState(target, 'x')).toBeUndefined();

    registration.activate();
    older.activate();
    expect(registration.isActive()).toBe(false);
    expect(older.isActive()).toBe(false);
  });

  it('keeps only the latest terminal baseline across thousands of completions', () => {
    const target = {};
    const registrations: ActiveTrackRegistration[] = [];

    for (let index = 0; index < 2_500; index += 1) {
      const registration = registerActiveTrack(target, 'x', {
        state: () => ({ position: index, velocity: 0 }),
        restore: () => {
          throw new Error('covered terminal history must not be restored');
        },
      });
      registrations.push(registration);
      expect(registration.retire()).toBe(true);
    }

    const latest = registrations.at(-1)!;
    expect(
      registrations.filter((registration) => registration.isActive()),
    ).toEqual([latest]);
    expect(latest.isOwner()).toBe(true);
    expect(activeTrackState(target, 'x')?.position).toBe(2_499);

    expect(latest.release()).toBe(false);
    expect(activeTrackState(target, 'x')).toBeUndefined();
  });

  it('matches a deterministic ownership model through mixed lifecycle operations', () => {
    const target = {};
    const entries: ModelEntry[] = [];
    const stack: ModelEntry[] = [];
    const random = randomSequence(0x5eedc0de);
    let actualRestores = 0;
    let expectedRestores = 0;

    const register = (): void => {
      const order = entries.length;
      const entry = {} as ModelEntry;
      const registration = registerActiveTrack(target, 'score', {
        state: () => ({ position: order, velocity: -order }),
        restore: () => {
          actualRestores += 1;
        },
      });
      Object.assign(entry, {
        active: true,
        order,
        registration,
      });
      entries.push(entry);
      stack.push(entry);
    };

    const activate = (entry: ModelEntry): void => {
      entry.registration.activate();
      if (entry.active) return;
      const nextIndex = stack.findIndex(
        (candidate) => candidate.order > entry.order,
      );
      if (nextIndex < 0) stack.push(entry);
      else stack.splice(nextIndex, 0, entry);
      entry.active = true;
    };

    const release = (entry: ModelEntry, restore: boolean): void => {
      const index = stack.indexOf(entry);
      const wasActive = entry.active && index >= 0;
      const wasOwner = wasActive && index === stack.length - 1;
      const expectedRestore = wasOwner && index > 0 && restore;

      expect(entry.registration.release({ restore })).toBe(expectedRestore);
      if (!wasActive) return;
      stack.splice(index, 1);
      entry.active = false;
      if (expectedRestore) expectedRestores += 1;
      expect(actualRestores).toBe(expectedRestores);
    };

    const retire = (entry: ModelEntry): void => {
      const index = stack.indexOf(entry);
      const wasActive = entry.active && index >= 0;
      expect(entry.registration.retire()).toBe(wasActive);
      if (!wasActive) return;
      if (index === stack.length - 1) {
        for (const covered of stack.splice(0, index)) covered.active = false;
        return;
      }
      stack.splice(index, 1);
      entry.active = false;
    };

    for (let index = 0; index < 64; index += 1) register();

    for (let step = 0; step < 12_000; step += 1) {
      if (entries.length < 256 && random() % 19 === 0) register();
      const entry = entries[random() % entries.length]!;
      switch (random() % 3) {
        case 0:
          activate(entry);
          break;
        case 1:
          release(entry, random() % 4 !== 0);
          break;
        default:
          retire(entry);
      }

      const owner = stack.at(-1);
      expect(activeTrackState(target, 'score')?.position).toBe(owner?.order);
      if (step % 64 === 0) {
        for (const candidate of entries) {
          expect(candidate.registration.isActive()).toBe(candidate.active);
          expect(candidate.registration.isOwner()).toBe(candidate === owner);
        }
      }
    }

    for (const entry of entries) entry.registration.release({ restore: false });
    expect(activeTrackState(target, 'score')).toBeUndefined();
  });
});
