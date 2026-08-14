import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createSpring } from '@motion-core/spring';
import { gsap } from 'gsap';
import {
  MotionCoreSpringPlugin,
  registerMotionCoreSpringPlugin,
  springTo,
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

  it('automatically inherits analytical velocity from an overlapping timeline track', () => {
    const target = { score: 0 };
    const interruptionTime = 0.2;
    const sampleTime = 0.08;
    const first = createSpring({
      from: 0,
      to: 100,
      velocity: 300,
      ...parameters,
    });
    const handoff = first.stateAt(interruptionTime);
    const redirected = createSpring({
      from: handoff.position,
      to: 240,
      velocity: handoff.velocity,
      ...parameters,
      stiffness: 240,
      damping: 26,
    });
    const timeline = gsap.timeline({ paused: true });

    timeline.to(
      target,
      {
        motionSpring: {
          values: { score: 100 },
          velocity: { score: 300 },
          parameters,
        },
      },
      0,
    );
    timeline.to(
      target,
      {
        motionSpring: {
          values: { score: 240 },
          velocity: { score: -999 },
          parameters: { ...parameters, stiffness: 240, damping: 26 },
        },
      },
      interruptionTime,
    );

    timeline.time(interruptionTime + sampleTime, true);

    expect(target.score).toBeCloseTo(redirected.positionAt(sampleTime), 10);
    expect(target.score).not.toBeCloseTo(
      createSpring({
        from: handoff.position,
        to: 240,
        velocity: -999,
        ...parameters,
        stiffness: 240,
        damping: 26,
      }).positionAt(sampleTime),
      4,
    );
  });

  it('keeps automatic handoff deterministic across direct and partitioned seeks', () => {
    const createTimeline = (target: { score: number }): gsap.core.Timeline =>
      gsap
        .timeline({ paused: true })
        .to(
          target,
          {
            motionSpring: {
              values: { score: 100 },
              velocity: { score: 250 },
              parameters,
            },
          },
          0,
        )
        .to(
          target,
          {
            motionSpring: {
              values: { score: -80 },
              parameters: { ...parameters, damping: 18 },
            },
          },
          0.2,
        );

    const directTarget = { score: 0 };
    const partitionedTarget = { score: 0 };
    const direct = createTimeline(directTarget);
    const partitioned = createTimeline(partitionedTarget);

    direct.time(0.35, true);
    partitioned.time(0.1, true).time(0.2, true).time(0.35, true);

    expect(directTarget.score).toBeCloseTo(partitionedTarget.score, 12);
  });

  it('restores the previous track when reversing before the handoff', () => {
    const target = { score: 0 };
    const first = createSpring({ from: 0, to: 100, velocity: 0, ...parameters });
    const handoff = first.stateAt(0.2);
    const redirected = createSpring({
      from: handoff.position,
      to: 240,
      velocity: handoff.velocity,
      ...parameters,
    });
    const timeline = gsap
      .timeline({ paused: true })
      .to(
        target,
        {
          motionSpring: {
            values: { score: 100 },
            parameters,
          },
        },
        0,
      )
      .to(
        target,
        {
          motionSpring: {
            values: { score: 240 },
            parameters,
          },
        },
        0.2,
      );

    timeline.time(0.4, true);
    timeline.time(0.1, true);

    expect(target.score).toBeCloseTo(first.positionAt(0.1), 10);
    timeline.time(0.3, true);
    expect(target.score).toBeCloseTo(redirected.positionAt(0.1), 10);
  });

  it('hands off only matching properties and keeps other tracks independent', () => {
    const target = { x: 0, y: 0 };
    const firstX = createSpring({ from: 0, to: 100, velocity: 0, ...parameters });
    const firstY = createSpring({ from: 0, to: 200, velocity: 0, ...parameters });
    const handoff = firstX.stateAt(0.2);
    const redirectedX = createSpring({
      from: handoff.position,
      to: -50,
      velocity: handoff.velocity,
      ...parameters,
    });
    const timeline = gsap
      .timeline({ paused: true })
      .to(
        target,
        {
          motionSpring: {
            values: { x: 100, y: 200 },
            parameters,
          },
        },
        0,
      )
      .to(
        target,
        {
          motionSpring: {
            values: { x: -50 },
            parameters,
          },
        },
        0.2,
      );

    timeline.time(0.3, true);

    expect(Number.parseFloat(String(target.x))).toBeCloseTo(
      redirectedX.positionAt(0.1),
      10,
    );
    expect(Number.parseFloat(String(target.y))).toBeCloseTo(
      firstY.positionAt(0.3),
      10,
    );
  });

  it('restores the covered spring when the newer track is killed', () => {
    const target = { score: 0 };
    const firstSpring = createSpring({
      from: 0,
      to: 100,
      velocity: 200,
      ...parameters,
    });
    const first = gsap.to(target, {
      paused: true,
      motionSpring: {
        values: { score: 100 },
        velocity: { score: 200 },
        parameters,
      },
    });
    first.time(0.2, true);
    const second = gsap.to(target, {
      paused: true,
      motionSpring: {
        values: { score: -100 },
        parameters,
      },
    });
    second.time(0.1, true);
    expect(target.score).not.toBeCloseTo(firstSpring.positionAt(0.2), 8);

    second.kill();

    expect(target.score).toBeCloseTo(firstSpring.positionAt(0.2), 10);
    first.time(0.3, true);
    expect(target.score).toBeCloseTo(firstSpring.positionAt(0.3), 10);
  });

  it('suppresses lifecycle callbacks from a fully covered track', () => {
    const target = { score: 0 };
    const firstSettle = vi.fn();
    const secondSettle = vi.fn();
    const timeline = gsap
      .timeline({ paused: true })
      .to(
        target,
        {
          motionSpring: {
            values: { score: 100 },
            parameters,
            onSettle: firstSettle,
          },
        },
        0,
      )
      .to(
        target,
        {
          motionSpring: {
            values: { score: 200 },
            parameters,
            onSettle: secondSettle,
          },
        },
        0.1,
    );

    timeline.time(0.11, true);
    const [firstTween, secondTween] = timeline.getChildren(
      false,
      true,
      false,
    ) as gsap.core.Tween[];
    firstTween!.time(firstTween!.duration(), true);
    secondTween!.time(secondTween!.duration(), true);

    expect(firstSettle).not.toHaveBeenCalled();
    expect(secondSettle).toHaveBeenCalledOnce();
    expect(target.score).toBe(200);
  });

  it('preserves a tween onInterrupt callback while cleaning its track', () => {
    const target = { score: 0 };
    const onInterrupt = vi.fn();
    const tween = gsap.to(target, {
      paused: true,
      onInterrupt,
      motionSpring: {
        values: { score: 100 },
        parameters,
      },
    });

    tween.time(0.1, true);
    tween.kill();

    expect(onInterrupt).toHaveBeenCalledOnce();
  });

  it('shares automatic handoff between springTo and the timeline plugin', () => {
    const target = { score: 0 };
    const controller = springTo(target, {
      targets: { score: 100 },
      velocity: { score: 250 },
      spring: parameters,
    });
    controller.pause();
    controller.seek(0.2);
    const handoff = controller.getSnapshot().states['score']!;
    const expected = createSpring({
      from: handoff.position,
      to: -50,
      velocity: handoff.velocity,
      ...parameters,
    });
    const tween = gsap.to(target, {
      paused: true,
      motionSpring: {
        values: { score: -50 },
        velocity: { score: -999 },
        parameters,
      },
    });

    tween.time(0.1, true);

    expect(target.score).toBeCloseTo(expected.positionAt(0.1), 10);
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

  it('cleans an automatic handoff stack when its GSAP context is reverted', () => {
    const target = { score: 10 };
    const context = gsap.context(() => {
      const first = gsap.to(target, {
        paused: true,
        motionSpring: {
          values: { score: 100 },
          parameters,
        },
      });
      first.time(0.2, true);
      const second = gsap.to(target, {
        paused: true,
        motionSpring: {
          values: { score: -50 },
          parameters,
        },
      });
      second.time(0.1, true);
    });

    expect(target.score).not.toBe(10);
    context.revert();
    expect(target.score).toBe(10);

    const afterRevert = gsap.to(target, {
      paused: true,
      motionSpring: {
        values: { score: 30 },
        velocity: { score: 0 },
        parameters,
      },
    });
    afterRevert.time(0.01, true);
    const fresh = createSpring({ from: 10, to: 30, velocity: 0, ...parameters });
    expect(target.score).toBeCloseTo(fresh.positionAt(0.01), 10);
  });
});
