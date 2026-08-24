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
});
