import { beforeEach, describe, expect, it, vi } from 'vitest';

interface MockTweenVars {
  elapsed?: number;
  duration?: number;
  ease?: string;
  repeat?: number;
  onUpdate?: () => void;
  onComplete?: () => void;
}

interface MockClock {
  elapsed: number;
}

const mocks = vi.hoisted(() => {
  const calls: Array<{
    clock: MockClock;
    vars: MockTweenVars;
    tween: {
      kill: ReturnType<typeof vi.fn>;
      totalTime: ReturnType<typeof vi.fn>;
    };
  }> = [];

  return {
    calls,
    gsap: {
      getProperty: vi.fn(
        (target: Record<string, unknown>, property: string) => target[property],
      ),
      quickSetter: vi.fn(
        (target: Record<string, unknown>, property: string) => (value: number) => {
          target[property] = value;
        },
      ),
      to: vi.fn((clock: MockClock, vars: MockTweenVars) => {
        const tween = { kill: vi.fn(), totalTime: vi.fn(() => clock.elapsed) };
        calls.push({ clock, vars, tween });
        return tween;
      }),
    },
  };
});

vi.mock('gsap', () => ({ gsap: mocks.gsap }));

import { springTo } from '../src/index.js';

const spring = {
  mass: 1,
  stiffness: 180,
  damping: 24,
  settle: { position: 0.1, velocity: 0.1 },
};

describe('springTo', () => {
  beforeEach(() => {
    mocks.calls.length = 0;
    vi.clearAllMocks();
  });

  it('uses solver-derived duration and analytical samples', () => {
    const target = { x: 0 };
    const controller = springTo(target, { x: 500, spring });
    const call = mocks.calls[0]!;

    expect(call.vars.duration).toBe(controller.duration);
    expect(call.vars.ease).toBe('none');

    call.clock.elapsed = 0.2;
    call.vars.onUpdate?.();
    expect(target.x).toBeCloseTo(controller.springs.x!.positionAt(0.2), 10);

    call.vars.onComplete?.();
    expect(target.x).toBe(500);
  });

  it('supports multiple transform properties with one GSAP clock', () => {
    const target = { x: 0, scale: 1 };
    const controller = springTo(target, { x: 300, scale: 2, spring });

    expect(mocks.calls).toHaveLength(1);
    expect(controller.springs.x).toBeDefined();
    expect(controller.springs.scale).toBeDefined();
    expect(controller.duration).toBe(
      Math.max(
        controller.springs.x!.getSettlingDuration(),
        controller.springs.scale!.getSettlingDuration(),
      ),
    );
  });

  it('merges physical and settling overrides per property', () => {
    const target = { x: 0, rotation: 0, scale: 1 };
    const controller = springTo(target, {
      x: 500,
      rotation: 90,
      scale: 1.2,
      spring: {
        ...spring,
        settle: {
          position: 0.1,
          velocity: 0.1,
          maxDuration: 12,
          refinementIterations: 32,
        },
      },
      properties: {
        rotation: {
          damping: 30,
          settle: { position: 0.05 },
        },
        scale: {
          stiffness: 240,
          settle: { position: 0.001, velocity: 0.001 },
        },
      },
    });

    expect(controller.springs.x!.settling).toEqual({
      positionEpsilon: 0.1,
      velocityEpsilon: 0.1,
      maxDuration: 12,
      refinementIterations: 32,
    });
    expect(controller.springs.rotation!.parameters.damping).toBe(30);
    expect(controller.springs.rotation!.settling).toEqual({
      positionEpsilon: 0.05,
      velocityEpsilon: 0.1,
      maxDuration: 12,
      refinementIterations: 32,
    });
    expect(controller.springs.scale!.parameters.stiffness).toBe(240);
    expect(controller.springs.scale!.settling).toEqual({
      positionEpsilon: 0.001,
      velocityEpsilon: 0.001,
      maxDuration: 12,
      refinementIterations: 32,
    });
    expect(controller.duration).toBe(
      Math.max(
        controller.springs.x!.getSettlingDuration(),
        controller.springs.rotation!.getSettlingDuration(),
        controller.springs.scale!.getSettlingDuration(),
      ),
    );
  });

  it('prefers property velocity over a shared initial velocity', () => {
    const controller = springTo(
      { x: 0, y: 0 },
      {
        x: 100,
        y: 100,
        spring,
        velocity: 50,
        properties: { y: { velocity: 250 } },
      },
    );

    expect(controller.springs.x!.velocityAt(0)).toBe(50);
    expect(controller.springs.y!.velocityAt(0)).toBe(250);
  });

  it('supports arbitrary numeric object properties with one clock', () => {
    const target = { opacity: 0, score: 10 };
    const controller = springTo(target, {
      targets: { opacity: 1, score: 100 },
      spring,
      properties: { opacity: { settle: { position: 0.001 } } },
    });
    const call = mocks.calls[0]!;

    call.clock.elapsed = 0.2;
    call.vars.onUpdate?.();
    expect(target.opacity).toBeCloseTo(
      controller.springs['opacity']!.positionAt(0.2),
      10,
    );
    expect(target.score).toBeCloseTo(
      controller.springs['score']!.positionAt(0.2),
      10,
    );
    expect(controller.springs['opacity']!.settling.positionEpsilon).toBe(0.001);
  });

  it('parses and preserves a single CSS unit', () => {
    const target: Record<string, unknown> = { '--distance': '0px' };
    const controller = springTo(target, {
      targets: { '--distance': '100px' },
      spring,
    });
    const call = mocks.calls[0]!;

    expect(mocks.gsap.quickSetter).toHaveBeenCalledWith(target, '--distance', 'px');
    call.clock.elapsed = 0.2;
    call.vars.onUpdate?.();
    expect(target['--distance']).toBeCloseTo(
      controller.springs['--distance']!.positionAt(0.2),
      10,
    );

    controller.retarget({ '--distance': 200 });
    expect(mocks.gsap.quickSetter).toHaveBeenLastCalledWith(
      target,
      '--distance',
      'px',
    );
  });

  it('uses explicit read and write adapters without touching GSAP properties', () => {
    const target = { nested: { progress: 0 } };
    const controller = springTo(target, {
      targets: { progress: 1 },
      spring,
      adapters: {
        progress: {
          read: () => target.nested.progress,
          write: (_target, value) => {
            target.nested.progress = value;
          },
        },
      },
    });
    const call = mocks.calls[0]!;

    call.clock.elapsed = 0.2;
    call.vars.onUpdate?.();
    expect(target.nested.progress).toBeCloseTo(
      controller.springs['progress']!.positionAt(0.2),
      10,
    );
    expect(mocks.gsap.getProperty).not.toHaveBeenCalled();
    expect(mocks.gsap.quickSetter).not.toHaveBeenCalled();
  });

  it('rejects complex strings and incompatible units', () => {
    expect(() =>
      springTo(
        { color: '#000' },
        { targets: { color: '#fff' }, spring },
      ),
    ).toThrow(TypeError);
    expect(() =>
      springTo(
        { width: '0px' },
        { targets: { width: '100deg' }, spring },
      ),
    ).toThrow(TypeError);
  });

  it('retargets from the current position and velocity', () => {
    const target = { x: 0 };
    const controller = springTo(target, { x: 600, velocity: { x: 500 }, spring });
    const first = mocks.calls[0]!;

    first.clock.elapsed = 0.23;
    const before = controller.getSnapshot().states.x!;
    controller.retarget({ x: 100 });

    expect(first.tween.kill).toHaveBeenCalledOnce();
    expect(mocks.calls).toHaveLength(2);
    expect(controller.springs.x!.positionAt(0)).toBeCloseTo(before.position, 10);
    expect(controller.springs.x!.velocityAt(0)).toBeCloseTo(before.velocity, 10);
  });

  it('rejects calls without a supported target property', () => {
    expect(() => springTo({}, { spring })).toThrow(TypeError);
  });

  it('stops an unsettled spring without snapping by default', () => {
    const target = { x: 0 };
    const onUnsettled = vi.fn();
    const onComplete = vi.fn();
    const controller = springTo(target, {
      x: 100,
      spring: { ...spring, damping: 0, settle: { maxDuration: 2 } },
      onUnsettled,
      onComplete,
    });
    const call = mocks.calls[0]!;

    expect(controller.duration).toBe(2);
    call.vars.onComplete?.();
    const stoppedPosition = controller.springs.x!.positionAt(2);
    expect(target.x).toBeCloseTo(stoppedPosition, 10);
    expect(target.x).not.toBe(100);
    expect(onUnsettled).toHaveBeenCalledOnce();
    expect(onComplete).toHaveBeenCalledOnce();

    call.vars.onComplete?.();
    expect(onUnsettled).toHaveBeenCalledOnce();
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it('snaps an unsettled spring only when explicitly requested', () => {
    const target = { x: 0 };
    const controller = springTo(target, {
      x: 100,
      spring: { ...spring, damping: 0, settle: { maxDuration: 2 } },
      unsettled: 'snap',
    });

    mocks.calls[0]!.vars.onComplete?.();
    expect(controller.springs.x!.getSettlingResult().settled).toBe(false);
    expect(target.x).toBe(100);
  });

  it('continues sampling an unsettled spring until it is killed', () => {
    const target = { x: 0 };
    const onUnsettled = vi.fn();
    const onComplete = vi.fn();
    const controller = springTo(target, {
      x: 100,
      spring: { ...spring, damping: 0, settle: { maxDuration: 2 } },
      unsettled: 'continue',
      onUnsettled,
      onComplete,
    });
    const call = mocks.calls[0]!;

    expect(controller.duration).toBe(Number.POSITIVE_INFINITY);
    expect(call.vars.duration).toBe(1);
    expect(call.vars.repeat).toBe(-1);
    call.tween.totalTime.mockReturnValue(2.5);
    call.vars.onUpdate?.();
    expect(target.x).toBeCloseTo(controller.springs.x!.positionAt(2.5), 10);
    expect(onUnsettled).toHaveBeenCalledOnce();
    expect(onComplete).not.toHaveBeenCalled();

    call.tween.totalTime.mockReturnValue(4.5);
    call.vars.onUpdate?.();
    expect(onUnsettled).toHaveBeenCalledOnce();

    controller.kill();
    controller.kill();
    expect(call.tween.kill).toHaveBeenCalledOnce();
  });

  it('rejects an unsettled spring before creating a GSAP tween in error mode', () => {
    expect(() =>
      springTo(
        { x: 0 },
        {
          x: 100,
          spring: { ...spring, damping: 0, settle: { maxDuration: 2 } },
          unsettled: 'error',
        },
      ),
    ).toThrow(RangeError);
    expect(mocks.gsap.to).not.toHaveBeenCalled();
  });
});
