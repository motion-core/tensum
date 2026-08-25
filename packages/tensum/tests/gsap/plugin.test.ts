import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { gsap } from 'gsap';
import {
  createMotionSpringTween,
  createSpring,
  registerSpringPlugin,
  springTo,
} from '../../src/index.js';

const parameters = {
  mass: 1,
  stiffness: 180,
  damping: 24,
  settle: { position: 0.001, velocity: 0.001 },
};

beforeAll(() => {
  registerSpringPlugin(gsap);
});

afterEach(() => {
  gsap.globalTimeline.clear();
});

describe('motionSpring effect', () => {
  it('preflights derived durations before laying out sequential timeline effects', () => {
    const target = { x: 0 };
    const first = createSpring({
      from: 0,
      to: 100,
      velocity: 0,
      ...parameters,
    });
    const second = createSpring({
      from: 100,
      to: 240,
      velocity: 0,
      ...parameters,
    });
    const timeline = gsap.timeline({ paused: true });

    timeline
      .motionSpring(target, {
        x: 100,
        from: { x: 0 },
        parameters,
      })
      .motionSpring(target, {
        x: 240,
        from: { x: 100 },
        parameters,
      });

    const [firstTween, secondTween] = timeline.getChildren(
      false,
      true,
      false,
    ) as gsap.core.Tween[];

    expect(firstTween!.duration()).toBeCloseTo(first.getSettlingDuration(), 6);
    expect(secondTween!.startTime()).toBeCloseTo(firstTween!.endTime(false), 7);
    expect(secondTween!.duration()).toBeCloseTo(
      second.getSettlingDuration(),
      6,
    );
    expect(timeline.duration()).toBeCloseTo(
      firstTween!.duration() + secondTween!.duration(),
      7,
    );

    timeline.time(firstTween!.duration() + 0.08, true);
    expect(Number.parseFloat(String(target.x))).toBeCloseTo(
      second.positionAt(0.08),
      9,
    );
  });

  it('preflights array targets before GSAP builds a stagger timeline', () => {
    const targets = [{ x: 0 }, { x: 20 }, { x: -30 }];
    const springs = targets.map((target) =>
      createSpring({ from: target.x, to: 100, velocity: 0, ...parameters }),
    );
    const driverDuration = Math.max(
      ...springs.map((spring) => spring.getSettlingDuration()),
    );
    const timeline = gsap.timeline({ paused: true });

    timeline.motionSpring(targets, {
      x: 100,
      parameters,
      tween: { stagger: 0.2 },
    });

    expect(timeline.duration()).toBeCloseTo(driverDuration + 0.4, 6);
    timeline.time(timeline.duration(), true);
    expect(
      targets.map((target) => Number.parseFloat(String(target.x))),
    ).toEqual([100, 100, 100]);
  });

  it('exposes a settled duration to a parent before adding a nested timeline', () => {
    const target = { rotation: 0 };
    const spring = createSpring({
      from: 0,
      to: 90,
      velocity: 0,
      ...parameters,
    });
    const child = gsap.timeline();

    child.motionSpring(target, {
      rotation: 90,
      from: { rotation: 0 },
      parameters,
    });

    const durationBeforeNesting = child.duration();
    const parent = gsap.timeline({ paused: true }).add(child, 0.35);

    expect(durationBeforeNesting).toBeCloseTo(spring.getSettlingDuration(), 6);
    expect(parent.duration()).toBeCloseTo(0.35 + durationBeforeNesting, 7);
  });

  it('keeps a preflight duration stable across invalidate and native repeats', () => {
    const target = { x: 0 };
    const spring = createSpring({
      from: 0,
      to: 100,
      velocity: 0,
      ...parameters,
    });
    const timeline = gsap.timeline({ paused: true });

    timeline.motionSpring(target, {
      x: 100,
      from: { x: 0 },
      parameters,
      tween: { repeat: 1, yoyo: true },
    });

    const tween = timeline.getChildren(
      false,
      true,
      false,
    )[0] as gsap.core.Tween;
    const duration = tween.duration();
    expect(duration).toBeCloseTo(spring.getSettlingDuration(), 6);
    expect(tween.totalDuration()).toBeCloseTo(duration * 2, 7);

    tween.time(0.1, true);
    tween.invalidate().time(0.1, true);

    expect(tween.duration()).toBe(duration);
    expect(tween.totalDuration()).toBeCloseTo(duration * 2, 7);
  });

  it('derives tween duration and samples raw GSAP time instead of eased ratio', () => {
    const target = { score: 0 };
    const tween = createMotionSpringTween(target, {
      values: { score: 100 },
      parameters,
      tween: { paused: true },
    });

    tween.time(0.01, true);
    const duration = tween.duration();
    expect(duration).toBeGreaterThan(0.1);
    tween.time(duration / 2, true);

    const spring = createSpring({
      from: 0,
      to: 100,
      velocity: 0,
      ...parameters,
    });
    expect(target.score).toBeCloseTo(spring.positionAt(duration / 2), 10);
  });

  it('is deterministic under seek and reverse playback', () => {
    const target = { score: 0 };
    const tween = createMotionSpringTween(target, {
      values: { score: 100 },
      parameters,
      tween: { paused: true },
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

  it('uses an explicit analytical handoff for an overlapping future track', () => {
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

    timeline.motionSpring(
      target,
      { values: { score: 100 }, velocity: { score: 300 }, parameters },
      0,
    );
    timeline.motionSpring(
      target,
      {
        values: { score: 240 },
        from: { score: handoff.position },
        velocity: { score: handoff.velocity },
        parameters: { ...parameters, stiffness: 240, damping: 26 },
      },
      interruptionTime,
    );

    timeline.time(interruptionTime + sampleTime, true);

    expect(target.score).toBeCloseTo(redirected.positionAt(sampleTime), 10);
  });

  it('keeps an explicit future handoff deterministic across direct and partitioned seeks', () => {
    const first = createSpring({
      from: 0,
      to: 100,
      velocity: 250,
      ...parameters,
    });
    const handoff = first.stateAt(0.2);
    const createTimeline = (target: { score: number }): gsap.core.Timeline => {
      const timeline = gsap.timeline({ paused: true });
      timeline.motionSpring(
        target,
        { values: { score: 100 }, velocity: { score: 250 }, parameters },
        0,
      );
      timeline.motionSpring(
        target,
        {
          values: { score: -80 },
          from: { score: handoff.position },
          velocity: { score: handoff.velocity },
          parameters: { ...parameters, damping: 18 },
        },
        0.2,
      );
      return timeline;
    };

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
    const first = createSpring({
      from: 0,
      to: 100,
      velocity: 0,
      ...parameters,
    });
    const handoff = first.stateAt(0.2);
    const redirected = createSpring({
      from: handoff.position,
      to: 240,
      velocity: handoff.velocity,
      ...parameters,
    });
    const timeline = gsap
      .timeline({ paused: true })
      .motionSpring(target, { values: { score: 100 }, parameters }, 0)
      .motionSpring(
        target,
        {
          values: { score: 240 },
          from: { score: handoff.position },
          velocity: { score: handoff.velocity },
          parameters,
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
    const firstX = createSpring({
      from: 0,
      to: 100,
      velocity: 0,
      ...parameters,
    });
    const firstY = createSpring({
      from: 0,
      to: 200,
      velocity: 0,
      ...parameters,
    });
    const handoff = firstX.stateAt(0.2);
    const redirectedX = createSpring({
      from: handoff.position,
      to: -50,
      velocity: handoff.velocity,
      ...parameters,
    });
    const timeline = gsap
      .timeline({ paused: true })
      .motionSpring(target, { values: { x: 100, y: 200 }, parameters }, 0)
      .motionSpring(
        target,
        {
          values: { x: -50 },
          from: { x: handoff.position },
          velocity: { x: handoff.velocity },
          parameters,
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
    const first = createMotionSpringTween(target, {
      values: { score: 100 },
      velocity: { score: 200 },
      parameters,
      tween: { paused: true },
    });
    first.time(0.2, true);
    const second = createMotionSpringTween(target, {
      values: { score: -100 },
      parameters,
      tween: { paused: true },
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
      .motionSpring(
        target,
        { values: { score: 100 }, parameters, onSettle: firstSettle },
        0,
      )
      .motionSpring(
        target,
        { values: { score: 200 }, parameters, onSettle: secondSettle },
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
    const tween = createMotionSpringTween(target, {
      values: { score: 100 },
      parameters,
      tween: { paused: true, onInterrupt },
    });

    tween.time(0.1, true);
    tween.kill();

    expect(onInterrupt).toHaveBeenCalledOnce();
  });

  it('calls the host onInterrupt once for a multi-target tween after invalidate', () => {
    const targets = [{ score: 0 }, { score: 20 }];
    const onInterrupt = vi.fn();
    const tween = createMotionSpringTween(targets, {
      values: { score: 100 },
      parameters,
      tween: { paused: true, onInterrupt },
    });

    tween.time(0.1, true);
    tween.invalidate().time(0.1, true);
    tween.kill();

    expect(onInterrupt).toHaveBeenCalledOnce();
  });

  it('shares automatic handoff between springTo and the timeline effect', () => {
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
    const tween = createMotionSpringTween(target, {
      values: { score: -50 },
      velocity: { score: -999 },
      parameters,
      tween: { paused: true },
    });

    tween.time(0.1, true);

    expect(target.score).toBeCloseTo(expected.positionAt(0.1), 10);
  });

  it('shares automatic handoff from the timeline effect to springTo', () => {
    const target = { score: 0 };
    const firstSpring = createSpring({
      from: 0,
      to: 100,
      velocity: 250,
      ...parameters,
    });
    const first = createMotionSpringTween(target, {
      values: { score: 100 },
      velocity: { score: 250 },
      parameters,
      tween: { paused: true },
    });
    first.time(0.2, true);
    const redirected = springTo(target, {
      targets: { score: -50 },
      velocity: { score: -999 },
      spring: parameters,
    });
    redirected.pause();

    expect(redirected.springs['score']!.stateAt(0)).toEqual(
      firstSpring.stateAt(0.2),
    );
  });

  it('uses an external write instead of a stale completed effect baseline', () => {
    const target = { score: 0 };
    const first = createMotionSpringTween(target, {
      values: { score: 100 },
      parameters,
      tween: { paused: true },
    });
    first.time(0.01, true);
    first.time(first.duration(), true);
    expect(target.score).toBe(100);

    target.score = -250;
    const second = createMotionSpringTween(target, {
      values: { score: 50 },
      parameters,
      tween: { paused: true },
    });
    second.time(0.05, true);

    const fresh = createSpring({
      from: -250,
      to: 50,
      velocity: 0,
      ...parameters,
    });
    expect(target.score).toBeCloseTo(fresh.positionAt(0.05), 10);
  });

  it('reconciles external writes while preflighting a new timeline effect', () => {
    const target = { score: 0 };
    const first = createMotionSpringTween(target, {
      values: { score: 100 },
      parameters,
      tween: { paused: true },
    });
    first.time(0.01, true);
    first.time(first.duration(), true);

    target.score = -250;
    const timeline = gsap.timeline({ paused: true }).motionSpring(target, {
      values: { score: 50 },
      parameters,
    });
    timeline.time(0.05, true);

    const fresh = createSpring({
      from: -250,
      to: 50,
      velocity: 0,
      ...parameters,
    });
    expect(target.score).toBeCloseTo(fresh.positionAt(0.05), 10);
  });

  it('automatically hands off between springTo controllers and restores on kill', () => {
    const target = { score: 0 };
    const first = springTo(target, {
      targets: { score: 100 },
      velocity: { score: 250 },
      spring: parameters,
    });
    first.pause();
    first.seek(0.2);
    const handoff = first.getSnapshot().states['score']!;
    const second = springTo(target, {
      targets: { score: -50 },
      velocity: { score: -999 },
      spring: parameters,
    });
    second.pause();

    expect(second.springs['score']!.stateAt(0)).toEqual(handoff);
    second.seek(0.1);
    const redirectedPosition = target.score;
    first.seek(0.3);
    expect(target.score).toBe(redirectedPosition);

    second.tween.kill();
    expect(target.score).toBeCloseTo(
      first.springs['score']!.positionAt(0.3),
      10,
    );
  });

  it('fires logical and physical callbacks once at each forward crossing', () => {
    const target = { score: 0 };
    const onLogicalComplete = vi.fn();
    const onSettle = vi.fn();
    const tween = createMotionSpringTween(target, {
      values: { score: 100 },
      parameters,
      onLogicalComplete,
      onSettle,
      tween: { paused: true },
    });

    tween.time(0.01, true);
    tween.time(tween.duration(), true);
    tween.time(tween.duration(), true);
    expect(onLogicalComplete).toHaveBeenCalledOnce();
    expect(onSettle).toHaveBeenCalledOnce();
  });

  it('inherits pause and timeScale while supporting property-level kill', () => {
    const target = { score: 0 };
    const tween = createMotionSpringTween(target, {
      values: { score: 100 },
      parameters,
      tween: { paused: true },
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

  it('lets GSAP remove the driver PropTween after its final property is killed', () => {
    const target = { x: 0, y: 0 };
    const tween = createMotionSpringTween(target, {
      values: { x: 100, y: 200 },
      parameters,
      tween: { paused: true },
    });
    const hostTween = tween as gsap.core.Tween & { _pt?: unknown };

    tween.time(0.01, true);
    tween.kill(target, 'x');
    expect(hostTween._pt).toBeDefined();

    tween.kill(target, 'y');
    expect(hostTween._pt).toBeFalsy();
  });

  it('recomputes an infinite driver after its unsettled property is killed', () => {
    const target = { x: 0, y: 0 };
    const finite = createSpring({
      from: 0,
      to: 100,
      velocity: 0,
      ...parameters,
    });
    const tween = createMotionSpringTween(target, {
      values: { x: 100, y: 100 },
      parameters,
      properties: {
        y: { damping: 0, settle: { maxDuration: 0.2 } },
      },
      unsettled: 'continue',
      tween: { paused: true, repeat: 2 },
    });

    tween.totalTime(0.01, true);
    expect(tween.repeat()).toBe(-1);

    tween.kill(target, 'y');

    expect(tween.repeat()).toBe(2);
    expect(tween.duration()).toBeCloseTo(finite.getSettlingDuration(), 6);
    tween.totalTime(tween.totalDuration(), true);
    expect(Number.parseFloat(String(target.x))).toBe(100);
  });

  it('recomputes a shared multi-target driver when its infinite target is killed', () => {
    const targets = [{ score: 0 }, { score: 100 }];
    const tween = createMotionSpringTween(targets, {
      values: { score: 100 },
      parameters: {
        ...parameters,
        damping: 0,
        settle: { maxDuration: 0.2 },
      },
      unsettled: 'continue',
      tween: { paused: true, repeat: 1 },
    });

    tween.totalTime(0.01, true);
    expect(tween.repeat()).toBe(-1);

    tween.kill(targets[0], 'score');

    expect(tween.repeat()).toBe(1);
    expect(tween.duration()).toBe(0);
  });

  it('keeps its preflighted snapshot stable when a tween is invalidated', () => {
    const target = { score: 0 };
    const springVars = {
      values: { score: 100 },
      parameters: { ...parameters },
    };
    const tween = createMotionSpringTween(target, {
      ...springVars,
      tween: { paused: true },
    });

    tween.time(0.01, true);
    const firstDuration = tween.duration();
    springVars.parameters.stiffness = 900;
    springVars.parameters.damping = 60;
    tween.invalidate().time(0.01, true);

    expect(tween.duration()).toBe(firstDuration);
    expect(target.score).toBeCloseTo(
      createSpring({ from: 0, to: 100, velocity: 0, ...parameters }).positionAt(
        0.01,
      ),
      10,
    );

    const valueBeforeKill = target.score;
    tween.kill();
    const replacement = createMotionSpringTween(target, {
      values: { score: 200 },
      velocity: 0,
      parameters,
      tween: { paused: true },
    });
    replacement.time(0.01, true);
    const expected = createSpring({
      from: valueBeforeKill,
      to: 200,
      velocity: 0,
      ...parameters,
    });
    expect(target.score).toBeCloseTo(expected.positionAt(0.01), 9);
  });

  it('hands off cycle-local position and velocity during a yoyo repeat', () => {
    const target = { score: 0 };
    const firstSpring = createSpring({
      from: 0,
      to: 100,
      velocity: 0,
      ...parameters,
    });
    const timeline = gsap.timeline({ paused: true });
    timeline.motionSpring(target, {
      values: { score: 100 },
      from: { score: 0 },
      parameters,
      tween: { repeat: 1, yoyo: true },
    });
    const firstTween = timeline.getChildren(
      false,
      true,
      false,
    )[0] as gsap.core.Tween;
    const handoffOffset = 0.1;
    const sampleTime = 0.05;
    const cycleTime = firstTween.duration() - handoffOffset;
    const firstState = firstSpring.stateAt(cycleTime);
    const redirected = createSpring({
      from: firstState.position,
      to: 200,
      velocity: -firstState.velocity,
      ...parameters,
    });
    timeline.motionSpring(
      target,
      {
        values: { score: 200 },
        from: { score: firstState.position },
        velocity: { score: -firstState.velocity },
        parameters,
      },
      firstTween.duration() + handoffOffset,
    );

    timeline.time(firstTween.duration() + handoffOffset + sampleTime, true);

    expect(target.score).toBeCloseTo(redirected.positionAt(sampleTime), 9);
  });

  it('keeps multi-target lifecycle callbacks explicitly target-scoped', () => {
    const targets = [{ score: 0 }, { score: 20 }];
    const onLogicalComplete = vi.fn();
    const onSettle = vi.fn();
    const tween = createMotionSpringTween(targets, {
      values: { score: 100 },
      parameters,
      onLogicalComplete,
      onSettle,
      tween: { paused: true },
    });

    tween.time(0.01, true);
    tween.time(tween.duration(), true);

    expect(onLogicalComplete).toHaveBeenCalledTimes(targets.length);
    expect(onSettle).toHaveBeenCalledTimes(targets.length);
  });

  it('releases completed ownership instead of restoring a covered zombie', () => {
    const target = { score: 0 };
    const timeline = gsap
      .timeline({ paused: true })
      .motionSpring(
        target,
        {
          values: { score: 100 },
          from: { score: 0 },
          parameters,
        },
        0,
      )
      .motionSpring(
        target,
        {
          values: { score: 200 },
          from: { score: 0 },
          parameters,
        },
        0.1,
      );
    const [, second] = timeline.getChildren(
      false,
      true,
      false,
    ) as gsap.core.Tween[];

    timeline.time(timeline.duration(), true);
    expect(target.score).toBe(200);
    second!.kill();

    expect(target.score).toBe(200);
  });

  it('preserves capped unsettled position and velocity for terminal handoff', () => {
    const target = { score: 0 };
    const cappedParameters = {
      ...parameters,
      damping: 0,
      settle: { maxDuration: 0.2 },
    };
    const firstSpring = createSpring({
      from: 0,
      to: 100,
      velocity: 0,
      ...cappedParameters,
    });
    const terminal = firstSpring.stateAt(0.2);
    const first = createMotionSpringTween(target, {
      values: { score: 100 },
      parameters: cappedParameters,
      tween: { paused: true },
    });

    first.time(0.01, true).time(first.duration(), true);
    const redirected = createSpring({
      from: terminal.position,
      to: 200,
      velocity: terminal.velocity,
      ...parameters,
    });
    const second = createMotionSpringTween(target, {
      values: { score: 200 },
      parameters,
      tween: { paused: true },
    });

    second.time(0.01, true);

    expect(target.score).toBeCloseTo(redirected.positionAt(0.01), 10);
  });

  it.each([
    ['repeat', false],
    ['yoyo repeat', true],
  ] as const)(
    'preserves cycle-direction velocity after a completed %s',
    (_label, yoyo) => {
      const target = { score: 0 };
      const initialVelocity = 120;
      const cappedParameters = {
        ...parameters,
        damping: 0,
        settle: { maxDuration: 0.2 },
      };
      const firstSpring = createSpring({
        from: 0,
        to: 100,
        velocity: initialVelocity,
        ...cappedParameters,
      });
      const first = createMotionSpringTween(target, {
        values: { score: 100 },
        parameters: cappedParameters,
        velocity: initialVelocity,
        tween: { paused: true, repeat: 1, yoyo },
      });

      first.time(0.01, true).totalTime(first.totalDuration(), true);
      const terminal = yoyo
        ? {
            position: firstSpring.positionAt(0),
            velocity: -firstSpring.velocityAt(0),
          }
        : firstSpring.stateAt(0.2);
      const redirected = createSpring({
        from: terminal.position,
        to: 200,
        velocity: terminal.velocity,
        ...parameters,
      });
      const second = createMotionSpringTween(target, {
        values: { score: 200 },
        parameters,
        tween: { paused: true },
      });

      second.time(0.01, true);

      expect(target.score).toBeCloseTo(redirected.positionAt(0.01), 10);
      second.kill();
      first.kill();
    },
  );

  it('does not let retired covered history reclaim ownership on a forward tick', () => {
    const target = { score: 0 };
    const first = createMotionSpringTween(target, {
      values: { score: 100 },
      parameters,
      tween: { paused: true },
    });
    first.time(0.2, true);
    const second = createMotionSpringTween(target, {
      values: { score: 200 },
      parameters,
      tween: { paused: true },
    });
    second.time(0.01, true).time(second.duration(), true);
    expect(target.score).toBe(200);

    first.time(0.3, true);

    expect(target.score).toBe(200);
  });

  it('uses totalTime for an explicitly continuing unsettled spring', () => {
    const target = { score: 0 };
    const onUnsettled = vi.fn();
    const tween = createMotionSpringTween(target, {
      values: { score: 100 },
      parameters: {
        ...parameters,
        damping: 0,
        settle: { maxDuration: 0.2 },
      },
      unsettled: 'continue',
      onUnsettled,
      tween: { paused: true },
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
      tween = createMotionSpringTween(target, {
        values: { score: 100 },
        parameters,
        tween: { paused: true },
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
      const first = createMotionSpringTween(target, {
        values: { score: 100 },
        parameters,
        tween: { paused: true },
      });
      first.time(0.2, true);
      const second = createMotionSpringTween(target, {
        values: { score: -50 },
        parameters,
        tween: { paused: true },
      });
      second.time(0.1, true);
    });

    expect(target.score).not.toBe(10);
    context.revert();
    expect(target.score).toBe(10);

    const afterRevert = createMotionSpringTween(target, {
      values: { score: 30 },
      velocity: { score: 0 },
      parameters,
      tween: { paused: true },
    });
    afterRevert.time(0.01, true);
    const fresh = createSpring({
      from: 10,
      to: 30,
      velocity: 0,
      ...parameters,
    });
    expect(target.score).toBeCloseTo(fresh.positionAt(0.01), 10);
  });

  it('reverts an invalidated multi-target effect to its original baseline', () => {
    const targets = [{ score: 10 }, { score: 20 }];
    const onInterrupt = vi.fn();
    let tween: gsap.core.Tween | undefined;
    const context = gsap.context(() => {
      tween = createMotionSpringTween(targets, {
        values: { score: 100 },
        parameters,
        tween: { paused: true, onInterrupt },
      });
    });

    tween!.time(0.1, true);
    tween!.invalidate().time(0.2, true);
    context.revert();

    expect(targets.map((target) => target.score)).toEqual([10, 20]);
    expect(onInterrupt).toHaveBeenCalledOnce();
  });

  it('negates inherited velocity when handing off from reversed effect playback', () => {
    const target = { score: 0 };
    const firstSpring = createSpring({
      from: 0,
      to: 100,
      velocity: 0,
      ...parameters,
    });
    const first = createMotionSpringTween(target, {
      values: { score: 100 },
      parameters,
      tween: { paused: true },
    });
    first.time(0.2, true).reverse().pause();

    const redirected = springTo(target, {
      targets: { score: 200 },
      spring: parameters,
    });
    redirected.pause();

    expect(redirected.springs['score']!.stateAt(0)).toEqual({
      position: firstSpring.positionAt(0.2),
      velocity: -firstSpring.velocityAt(0.2),
    });

    redirected.kill();
    first.kill();
  });

  it('negates inherited velocity when handing off from a reversed controller', () => {
    const target = { score: 0 };
    const first = springTo(target, {
      targets: { score: 100 },
      spring: parameters,
    });
    first.pause();
    first.seek(0.2);
    const forwardState = first.springs['score']!.stateAt(0.2);
    first.playbackReverse();
    first.pause();
    const redirected = createSpring({
      from: forwardState.position,
      to: 200,
      velocity: -forwardState.velocity,
      ...parameters,
    });
    const second = createMotionSpringTween(target, {
      values: { score: 200 },
      parameters,
      tween: { paused: true },
    });

    second.time(0.05, true);

    expect(target.score).toBeCloseTo(redirected.positionAt(0.05), 9);

    second.kill();
    first.kill();
  });

  it('stops later lifecycle callbacks when a logical callback kills the tween', () => {
    const events: string[] = [];
    let tween: gsap.core.Tween;
    tween = createMotionSpringTween(
      { score: 0 },
      {
        values: { score: 100 },
        parameters,
        onLogicalComplete: () => {
          events.push('logical');
          tween.kill();
        },
        onSettle: () => events.push('settle'),
        tween: { paused: true },
      },
    );

    tween.time(0.01, true);
    tween.time(tween.duration(), false);

    expect(events).toEqual(['logical']);
  });
});
