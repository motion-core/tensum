import { describe, expect, it, vi } from 'vitest';
import {
  activeTrackState,
  registerActiveTrack,
} from '../../src/gsap/active-tracks.js';

describe('active spring track registry', () => {
  it('keeps one owner per target and property and restores the covered track', () => {
    const target = {};
    const restoreFirst = vi.fn();
    const first = registerActiveTrack(target, 'x', {
      state: () => ({ position: 10, velocity: 20, unit: 'px' }),
      restore: restoreFirst,
    });

    expect(first.isOwner()).toBe(true);
    expect(activeTrackState(target, 'x')).toEqual({
      position: 10,
      velocity: 20,
      unit: 'px',
    });

    const second = registerActiveTrack(target, 'x', {
      state: () => ({ position: 30, velocity: 40, unit: 'px' }),
      restore: vi.fn(),
    });
    expect(first.isOwner()).toBe(false);
    expect(second.isOwner()).toBe(true);
    expect(activeTrackState(target, 'x')).toEqual({
      position: 30,
      velocity: 40,
      unit: 'px',
    });

    expect(second.release()).toBe(true);
    expect(restoreFirst).toHaveBeenCalledOnce();
    expect(first.isOwner()).toBe(true);
    first.release();
    expect(activeTrackState(target, 'x')).toBeUndefined();
  });

  it('reactivates a released track without disturbing other properties', () => {
    const target = {};
    const x = registerActiveTrack(target, 'x', {
      state: () => ({ position: 1, velocity: 2 }),
      restore: vi.fn(),
    });
    const y = registerActiveTrack(target, 'y', {
      state: () => ({ position: 3, velocity: 4 }),
      restore: vi.fn(),
    });

    x.release();
    expect(x.isActive()).toBe(false);
    expect(y.isOwner()).toBe(true);
    x.activate();
    expect(x.isOwner()).toBe(true);
    expect(y.isOwner()).toBe(true);

    x.release();
    y.release();
  });

  it('samples an owner at the requested global handoff time', () => {
    const target = {};
    const state = vi.fn((time?: number) => ({
      position: time ?? 0,
      velocity: (time ?? 0) * 2,
    }));
    const registration = registerActiveTrack(target, 'score', {
      state,
      restore: vi.fn(),
    });

    expect(activeTrackState(target, 'score', 1.25)).toEqual({
      position: 1.25,
      velocity: 2.5,
    });
    expect(state).toHaveBeenCalledWith(1.25);
    registration.release();
  });

  it('collapses completed ownership to one terminal baseline', () => {
    const target = {};
    const first = registerActiveTrack(target, 'x', {
      state: () => ({ position: 10, velocity: 0 }),
      restore: vi.fn(),
    });
    const second = registerActiveTrack(target, 'x', {
      state: () => ({ position: 20, velocity: 0 }),
      restore: vi.fn(),
    });
    const third = registerActiveTrack(target, 'x', {
      state: () => ({ position: 30, velocity: 0 }),
      restore: vi.fn(),
    });

    expect(third.retire()).toBe(true);
    expect(third.isOwner()).toBe(true);
    expect(first.isActive()).toBe(false);
    expect(second.isActive()).toBe(false);
    expect(activeTrackState(target, 'x')?.position).toBe(30);

    third.release();
  });

  it('preserves original priority when a retired track reactivates for reverse playback', () => {
    const target = {};
    const restoreFirst = vi.fn();
    const first = registerActiveTrack(target, 'x', {
      state: () => ({ position: 10, velocity: 1 }),
      restore: restoreFirst,
    });
    const second = registerActiveTrack(target, 'x', {
      state: () => ({ position: 20, velocity: 2 }),
      restore: vi.fn(),
    });

    second.retire();
    expect(first.isActive()).toBe(false);
    first.activate();
    expect(first.isOwner()).toBe(false);
    expect(second.isOwner()).toBe(true);

    expect(second.release()).toBe(true);
    expect(first.isOwner()).toBe(true);
    expect(restoreFirst).toHaveBeenCalledOnce();
    first.release();
  });

  it('removes a covered track when it completes without disturbing its owner', () => {
    const target = {};
    const first = registerActiveTrack(target, 'x', {
      state: () => ({ position: 10, velocity: 1 }),
      restore: vi.fn(),
    });
    const second = registerActiveTrack(target, 'x', {
      state: () => ({ position: 20, velocity: 2 }),
      restore: vi.fn(),
    });

    expect(first.retire()).toBe(true);
    expect(first.isActive()).toBe(false);
    expect(second.isOwner()).toBe(true);
    expect(activeTrackState(target, 'x')?.position).toBe(20);

    second.release();
  });

  it('rejects primitive registry keys instead of retaining them globally', () => {
    expect(() =>
      registerActiveTrack('.item', 'x', {
        state: () => ({ position: 0, velocity: 0 }),
        restore: vi.fn(),
      }),
    ).toThrow(TypeError);
    expect(activeTrackState('.item', 'x')).toBeUndefined();
  });
});
