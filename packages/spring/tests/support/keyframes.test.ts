import { describe, expect, it } from 'vitest';
import { createSpringKeyframes } from '../../src/index.js';

const parameters = { mass: 1, stiffness: 180, damping: 24 } as const;

describe('spring keyframes', () => {
  it('composes sequential analytical spring segments', () => {
    const sequence = createSpringKeyframes({
      from: 0,
      keyframes: [{ value: 100 }, { value: -50 }, { value: 200 }],
      parameters,
    });

    expect(sequence.segments).toHaveLength(3);
    expect(sequence.segments[0]!.startTime).toBe(0);
    expect(sequence.segments[1]!.startTime).toBe(sequence.segments[0]!.endTime);
    expect(sequence.segments[2]!.startTime).toBe(sequence.segments[1]!.endTime);
    expect(sequence.duration).toBe(sequence.segments[2]!.endTime);
    expect(sequence.positionAt(sequence.duration)).toBe(200);
    expect(sequence.velocityAt(sequence.duration)).toBe(0);
  });

  it('uses explicit startVelocity at a segment boundary', () => {
    const sequence = createSpringKeyframes({
      from: 0,
      keyframes: [{ value: 100 }, { value: 200, startVelocity: 450 }],
      parameters,
    });
    const boundary = sequence.segments[1]!.startTime;

    expect(sequence.positionAt(boundary)).toBe(100);
    expect(sequence.velocityAt(boundary)).toBe(450);
  });

  it('merges physical, settling, and timing overrides per segment', () => {
    const sequence = createSpringKeyframes({
      from: 0,
      keyframes: [
        { value: 100 },
        {
          value: 200,
          parameters: { stiffness: 320 },
          settle: { position: 0.01 },
          timing: { perceptualDuration: 0.2 },
        },
      ],
      parameters,
      settle: { position: 0.1, velocity: 0.2, maxDuration: 8 },
    });
    const second = sequence.segments[1]!.solution;

    expect(second.parameters.stiffness).toBe(320);
    expect(second.settling).toMatchObject({
      positionEpsilon: 0.01,
      velocityEpsilon: 0.2,
      maxDuration: 8,
    });
    expect(second.timing.perceptualDuration).toBe(0.2);
  });

  it('is deterministic regardless of intermediate sampling', () => {
    const options = {
      from: 0,
      keyframes: [{ value: 100 }, { value: -50 }, { value: 200 }],
      parameters,
    } as const;
    const direct = createSpringKeyframes(options);
    const sampled = createSpringKeyframes(options);
    const time = direct.segments[1]!.startTime + 0.2;

    for (const intermediate of [0.01, 0.5, 0.1, 1]) sampled.stateAt(intermediate);
    expect(sampled.stateAt(time)).toEqual(direct.stateAt(time));
  });

  it('allows an unsettled final segment but rejects one before another keyframe', () => {
    const finalUnsettled = createSpringKeyframes({
      from: 0,
      keyframes: [{ value: 100 }],
      parameters: { ...parameters, damping: 0 },
      settle: { maxDuration: 2 },
    });

    expect(finalUnsettled.getSettlingResult()).toMatchObject({
      duration: 2,
      settled: false,
    });
    expect(() =>
      createSpringKeyframes({
        from: 0,
        keyframes: [{ value: 100 }, { value: 200 }],
        parameters: { ...parameters, damping: 0 },
        settle: { maxDuration: 2 },
      }),
    ).toThrow(RangeError);
  });

  it('rejects empty sequences and invalid sample time', () => {
    expect(() =>
      createSpringKeyframes({ from: 0, keyframes: [], parameters }),
    ).toThrow(RangeError);
    const sequence = createSpringKeyframes({
      from: 0,
      keyframes: [{ value: 100 }],
      parameters,
    });
    expect(() => sequence.stateAt(-1)).toThrow(RangeError);
  });

  it('rejects explicit null segment options instead of applying defaults', () => {
    expect(() =>
      createSpringKeyframes({
        from: 0,
        keyframes: [{ value: 1, startVelocity: null as never }],
        parameters,
      }),
    ).toThrow(RangeError);
    expect(() =>
      createSpringKeyframes({
        from: 0,
        keyframes: [{ value: 1, parameters: null as never }],
        parameters,
      }),
    ).toThrow(TypeError);
    expect(() =>
      createSpringKeyframes({
        from: 0,
        keyframes: [{ value: 1, settle: null as never }],
        parameters,
      }),
    ).toThrow(TypeError);
    expect(() =>
      createSpringKeyframes({
        from: 0,
        keyframes: [{ value: 1, timing: null as never }],
        parameters,
      }),
    ).toThrow(TypeError);
  });

  it('rejects a combined perceptual duration that is not representable', () => {
    expect(() =>
      createSpringKeyframes({
        from: 0,
        keyframes: [{ value: 100 }, { value: 200 }],
        parameters,
        timing: { perceptualDuration: Number.MAX_VALUE },
      }),
    ).toThrow(/perceptualDuration must be a finite number/);
  });

  it('rejects a combined physical duration that is not representable', () => {
    expect(() =>
      createSpringKeyframes({
        from: 0,
        keyframes: [{ value: 1 }, { value: 2 }],
        parameters: { mass: 1e308, stiffness: 1e-308, damping: 2 },
        settle: {
          position: 0.9,
          velocity: 0.9,
          maxDuration: 1.7e308,
        },
        timing: { perceptualDuration: 0.1 },
      }),
    ).toThrow(/duration must be a finite number/);
  });
});
