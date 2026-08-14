import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createSpring } from '@motion-core/spring';
import { gsap } from 'gsap';
import {
  MotionCoreSpringPlugin,
  registerMotionCoreSpringPlugin,
} from '../src/index.js';

const parameters = {
  mass: 1,
  stiffness: 180,
  damping: 24,
  settle: { position: 0.001, velocity: 0.001 },
};

beforeAll(() => {
  registerMotionCoreSpringPlugin(gsap);
});

afterEach(() => {
  gsap.globalTimeline.clear();
});

describe('MotionCoreSpringPlugin', () => {
  it('registers as a real motionSpring special property', () => {
    expect(MotionCoreSpringPlugin.name).toBe('motionSpring');
    expect((gsap.plugins as Record<string, unknown>)['motionSpring']).toBeDefined();
  });

  it('derives tween duration and samples raw GSAP time instead of eased ratio', () => {
    const target = { score: 0 };
    const tween = gsap.to(target, {
      duration: 0.1,
      ease: 'power4.in',
      paused: true,
      motionSpring: {
        values: { score: 100 },
        parameters,
      },
    });

    tween.time(0.01, true);
    const duration = tween.duration();
    expect(duration).toBeGreaterThan(0.1);
    tween.time(duration / 2, true);

    const spring = createSpring({ from: 0, to: 100, velocity: 0, ...parameters });
    expect(target.score).toBeCloseTo(
      spring.positionAt(duration / 2),
      10,
    );
  });

  it('is deterministic under seek and reverse playback', () => {
    const target = { score: 0 };
    const tween = gsap.to(target, {
      paused: true,
      motionSpring: {
        values: { score: 100 },
        parameters,
      },
    });

    tween.time(0.01, true);
    const duration = tween.duration();
    tween.time(duration * 0.8, true);
    tween.time(duration * 0.25, true);
    const rewound = target.score;
    tween.time(duration * 0.8, true);
    tween.reverse();
    tween.time(duration * 0.25, true);

    expect(target.score).toBeCloseTo(rewound, 12);
    tween.time(duration, true);
    expect(target.score).toBe(100);
  });

  it('fires logical and physical callbacks once at each forward crossing', () => {
    const target = { score: 0 };
    const onLogicalComplete = vi.fn();
    const onSettle = vi.fn();
    const tween = gsap.to(target, {
      paused: true,
      motionSpring: {
        values: { score: 100 },
        parameters,
        onLogicalComplete,
        onSettle,
      },
    });

    tween.time(0.01, true);
    tween.time(tween.duration(), true);
    tween.time(tween.duration(), true);
    expect(onLogicalComplete).toHaveBeenCalledOnce();
    expect(onSettle).toHaveBeenCalledOnce();
  });

  it('inherits pause and timeScale while supporting property-level kill', () => {
    const target = { score: 0 };
    const tween = gsap.to(target, {
      paused: true,
      motionSpring: {
        values: { score: 100 },
        parameters,
      },
    });

    tween.time(0.01, true);
    tween.pause().timeScale(2).time(0.2, true);
    const beforeKill = target.score;
    expect(tween.paused()).toBe(true);
    expect(tween.timeScale()).toBe(2);

    tween.kill(target, 'score');
    tween.time(0.4, true);
    expect(target.score).toBe(beforeKill);
  });

  it('uses totalTime for an explicitly continuing unsettled spring', () => {
    const target = { score: 0 };
    const onUnsettled = vi.fn();
    const tween = gsap.to(target, {
      paused: true,
      motionSpring: {
        values: { score: 100 },
        parameters: {
          ...parameters,
          damping: 0,
          settle: { maxDuration: 0.2 },
        },
        unsettled: 'continue',
        onUnsettled,
      },
    });

    tween.totalTime(0.01, true);
    expect(tween.duration()).toBe(1);
    expect(tween.repeat()).toBe(-1);
    tween.totalTime(0.2, true);
    const atBoundary = target.score;
    tween.totalTime(1.2, true);

    expect(target.score).not.toBe(atBoundary);
    expect(onUnsettled).toHaveBeenCalledOnce();
  });

  it('restores the starting value when its GSAP context is reverted', () => {
    const target = { score: 10 };
    let tween: gsap.core.Tween | undefined;
    const context = gsap.context(() => {
      tween = gsap.to(target, {
        paused: true,
        motionSpring: {
          values: { score: 100 },
          parameters,
        },
      });
    });

    tween!.time(0.2, true);
    expect(target.score).not.toBe(10);
    context.revert();
    expect(target.score).toBe(10);
  });
});
