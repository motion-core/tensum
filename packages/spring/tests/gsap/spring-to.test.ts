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
      time: ReturnType<typeof vi.fn>;
      play: ReturnType<typeof vi.fn>;
      pause: ReturnType<typeof vi.fn>;
      resume: ReturnType<typeof vi.fn>;
      reverse: ReturnType<typeof vi.fn>;
      paused: ReturnType<typeof vi.fn>;
      eventCallback: ReturnType<typeof vi.fn>;
    };
  }> = [];

  return {
    calls,
    gsap: {
      utils: {
        toArray: vi.fn((target: unknown) => {
          if (
            target === null ||
            target === undefined ||
            typeof target === 'string'
          ) {
            return [];
          }
          return Array.isArray(target) ? target : [target];
        }),
      },
      getProperty: vi.fn(
        (target: Record<string, unknown>, property: string, unit?: string) => {
          const value = target[property];
          if (unit === 'native' || typeof value !== 'string') return value;
          return Number.parseFloat(value);
        },
      ),
      quickSetter: vi.fn(
        (target: Record<string, unknown>, property: string) =>
          (value: number) => {
            target[property] = value;
          },
      ),
      to: vi.fn((clock: MockClock, vars: MockTweenVars) => {
        let isPaused = false;
        let onInterrupt: (() => void) | undefined;
        const setLocalTime = (value: number): void => {
          if (vars.repeat === -1) {
            clock.elapsed = value;
            return;
          }
          const driverDuration = vars.duration ?? 0;
          const targetElapsed = vars.elapsed ?? 0;
          clock.elapsed =
            driverDuration === 0
              ? targetElapsed
              : Math.min(value / driverDuration, 1) * targetElapsed;
        };
        const tween = {
          kill: vi.fn(() => {
            onInterrupt?.();
          }),
          totalTime: vi.fn((value?: number) => {
            if (value === undefined) return clock.elapsed;
            setLocalTime(value);
            vars.onUpdate?.();
            return tween;
          }),
          time: vi.fn((value?: number) => {
            if (value === undefined) return clock.elapsed;
            setLocalTime(value);
            vars.onUpdate?.();
            return tween;
          }),
          play: vi.fn(() => {
            isPaused = false;
            return tween;
          }),
          pause: vi.fn(() => {
            isPaused = true;
            return tween;
          }),
          resume: vi.fn(() => {
            isPaused = false;
            return tween;
          }),
          reverse: vi.fn(() => tween),
          paused: vi.fn(() => isPaused),
          eventCallback: vi.fn((type: string, callback?: () => void) => {
            if (type !== 'onInterrupt') return undefined;
            if (callback === undefined) return onInterrupt;
            onInterrupt = callback;
            return tween;
          }),
        };
        calls.push({ clock, vars, tween });
        return tween;
      }),
    },
  };
});

vi.mock('gsap', () => ({ gsap: mocks.gsap }));

import { springTo } from '../../src/index.js';

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

    expect(call.vars.duration).toBeGreaterThanOrEqual(controller.duration);
    expect(call.vars.duration! - controller.duration).toBeLessThan(1e-7);
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

  it('writes both scale axes for DOM-like targets without changing plain-object scale', () => {
    const element = { nodeType: 1, scale: 1, scaleX: 1, scaleY: 1 };
    springTo(element, { scale: 1.75, spring });
    mocks.calls[0]!.vars.onComplete?.();

    expect(mocks.gsap.quickSetter).toHaveBeenCalledWith(
      element,
      'scaleX',
      undefined,
    );
    expect(mocks.gsap.quickSetter).toHaveBeenCalledWith(
      element,
      'scaleY',
      undefined,
    );
    expect(element.scaleX).toBe(1.75);
    expect(element.scaleY).toBe(1.75);

    const object = { scale: 1 };
    springTo(object, { scale: 1.5, spring });
    mocks.calls[1]!.vars.onComplete?.();
    expect(mocks.gsap.quickSetter).toHaveBeenCalledWith(
      object,
      'scale',
      undefined,
    );
    expect(object.scale).toBe(1.5);
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

    expect(mocks.gsap.quickSetter).toHaveBeenCalledWith(
      target,
      '--distance',
      'px',
    );
    call.clock.elapsed = 0.2;
    call.vars.onUpdate?.();
    expect(target['--distance']).toBeCloseTo(
      controller.springs['--distance']!.positionAt(0.2),
      10,
    );

    const next = springTo(target, {
      targets: { '--distance': 200 },
      spring,
    });
    expect(mocks.gsap.quickSetter).toHaveBeenLastCalledWith(
      target,
      '--distance',
      'px',
    );
    expect(next.springs['--distance']!.stateAt(0)).toEqual(
      controller.getSnapshot().states['--distance'],
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
      springTo({ color: '#000' }, { targets: { color: '#fff' }, spring }),
    ).toThrow(TypeError);
    expect(() =>
      springTo({ width: '0px' }, { targets: { width: '100deg' }, spring }),
    ).toThrow(TypeError);

    const target: Record<string, unknown> = { '--distance': '0px' };
    springTo(target, {
      targets: { '--distance': '100px' },
      spring,
    });
    mocks.calls.at(-1)!.clock.elapsed = 0.1;
    mocks.calls.at(-1)!.vars.onUpdate?.();
    expect(() =>
      springTo(target, {
        targets: { '--distance': '20deg' },
        spring,
      }),
    ).toThrow(TypeError);

    const element = { nodeType: 1, width: '100px' };
    expect(() =>
      springTo(element, {
        targets: { width: '20deg' },
        spring,
      }),
    ).toThrow(/Unit mismatch for width/);
    expect(mocks.gsap.getProperty).toHaveBeenLastCalledWith(
      element,
      'width',
      'native',
    );
  });

  it('automatically retargets from the active analytical state', () => {
    const target = { x: 0 };
    const controller = springTo(target, {
      x: 600,
      velocity: { x: 500 },
      spring,
    });
    expect('retarget' in controller).toBe(false);
    const first = mocks.calls[0]!;

    first.clock.elapsed = 0.23;
    const before = controller.getSnapshot().states.x!;
    const redirected = springTo(target, {
      x: 100,
      velocity: { x: -999 },
      spring,
    });

    expect(mocks.calls).toHaveLength(2);
    expect(redirected.springs.x!.positionAt(0)).toBeCloseTo(
      before.position,
      10,
    );
    expect(redirected.springs.x!.velocityAt(0)).toBeCloseTo(
      before.velocity,
      10,
    );

    const second = mocks.calls[1]!;
    second.clock.elapsed = 0.1;
    second.vars.onUpdate?.();
    const redirectedPosition = target.x;
    first.clock.elapsed = 0.4;
    first.vars.onUpdate?.();
    expect(target.x).toBe(redirectedPosition);
  });

  it('exposes GSAP playback controls and analytical seek', () => {
    const target = { x: 0 };
    const controller = springTo(target, { x: 500, spring });
    const call = mocks.calls[0]!;

    controller.pause();
    controller.resume();
    controller.play();
    controller.stop();
    controller.seek(0.2);
    controller.playbackReverse();

    expect(call.tween.pause).toHaveBeenCalledTimes(2);
    expect(call.tween.resume).toHaveBeenCalledOnce();
    expect(call.tween.play).toHaveBeenCalledOnce();
    expect(call.tween.time.mock.calls[0]?.[0]).toBeCloseTo(0.2, 6);
    expect(call.tween.time.mock.calls[0]?.[1]).toBe(false);
    expect(call.tween.reverse).toHaveBeenCalledOnce();
    expect(target.x).toBeCloseTo(controller.springs.x!.positionAt(0.2), 10);
    expect(() => controller.seek(-1)).toThrow(RangeError);
  });

  it('hands off from a paused active controller without resuming it', () => {
    const target = { x: 0 };
    const controller = springTo(target, { x: 500, spring });
    const first = mocks.calls[0]!;
    controller.pause();
    first.clock.elapsed = 0.2;
    const current = controller.getSnapshot().states.x!;

    const redirected = springTo(target, { x: 100, spring });

    expect(first.tween.pause).toHaveBeenCalledOnce();
    expect(first.tween.play).not.toHaveBeenCalled();
    expect(redirected.springs.x!.stateAt(0)).toEqual(current);
  });

  it('separates logical completion, physical settlement, and driver completion', () => {
    const events: string[] = [];
    const controller = springTo(
      { x: 0 },
      {
        x: 500,
        spring,
        onLogicalComplete: () => events.push('logical'),
        onSettle: () => events.push('settle'),
        onComplete: () => events.push('complete'),
      },
    );
    const call = mocks.calls[0]!;

    call.clock.elapsed = controller.springs.x!.timing.perceptualDuration;
    call.vars.onUpdate?.();
    expect(events).toEqual(['logical']);

    call.vars.onComplete?.();
    expect(events).toEqual(['logical', 'settle', 'complete']);
    call.vars.onComplete?.();
    expect(events).toEqual(['logical', 'settle', 'complete']);
  });

  it('does not emit a duplicate update while correcting the exact terminal state', () => {
    const onUpdate = vi.fn();
    const controller = springTo({ x: 0 }, { x: 500, spring, onUpdate });
    const call = mocks.calls[0]!;

    call.clock.elapsed = controller.duration;
    call.vars.onUpdate?.();
    call.vars.onComplete?.();

    expect(onUpdate).toHaveBeenCalledOnce();
    expect(onUpdate.mock.calls[0]?.[0]).toMatchObject({
      elapsed: controller.duration,
    });
  });

  it('maps an exact-end seek to GSAP safe duration without changing analytical time', () => {
    const target = { x: 0 };
    const onUpdate = vi.fn();
    const controller = springTo(target, { x: 500, spring, onUpdate });
    const call = mocks.calls[0]!;

    controller.seek(controller.duration);

    expect(call.tween.time).toHaveBeenLastCalledWith(call.vars.duration, false);
    expect(controller.getSnapshot().elapsed).toBe(controller.duration);
    expect(target.x).toBe(500);
    expect(onUpdate).toHaveBeenCalledOnce();
  });

  it.each(['stop', 'snap'] as const)(
    'clamps logical completion to the finite boundary in %s mode',
    (unsettled) => {
      const events: string[] = [];
      const controller = springTo(
        { x: 0 },
        {
          x: 100,
          spring: { ...spring, damping: 0, settle: { maxDuration: 0.05 } },
          unsettled,
          onLogicalComplete: () => events.push('logical'),
          onUnsettled: () => events.push('unsettled'),
          onComplete: () => events.push('complete'),
        },
      );

      expect(controller.springs.x!.timing.perceptualDuration).toBeGreaterThan(
        controller.duration,
      );
      mocks.calls[0]!.vars.onComplete?.();
      expect(events).toEqual(['logical', 'unsettled', 'complete']);
    },
  );

  it('retires covered history while preserving reverse ownership order', () => {
    const target = { x: 0 };
    const first = springTo(target, { x: 500, spring });
    const firstCall = mocks.calls[0]!;
    firstCall.clock.elapsed = 0.2;
    firstCall.vars.onUpdate?.();

    const second = springTo(target, { x: 100, spring });
    const secondCall = mocks.calls[1]!;
    secondCall.vars.onComplete?.();
    expect(target.x).toBe(100);

    firstCall.clock.elapsed = 0.3;
    firstCall.vars.onUpdate?.();
    expect(target.x).toBe(100);

    firstCall.clock.elapsed = 0.1;
    firstCall.vars.onUpdate?.();
    expect(target.x).toBe(100);

    second.seek(0);
    expect(target.x).toBeCloseTo(first.springs.x!.positionAt(0.1), 10);
  });

  it('rejects calls without a supported target property', () => {
    expect(() => springTo({}, { spring })).toThrow(TypeError);
  });

  it('rejects unsafe targets and malformed runtime configuration', () => {
    expect(() => springTo('.missing', { x: 100, spring })).toThrow(
      /exactly one resolved target; received 0/,
    );
    expect(() => springTo([{}, {}], { x: 100, spring })).toThrow(
      /exactly one resolved target; received 2/,
    );
    expect(() =>
      springTo({ x: 0 }, { x: 100, spring, unsettled: 'loop' as 'stop' }),
    ).toThrow(/unsettled must be one of/);
    expect(() =>
      springTo(
        { x: 0 },
        { x: 100, spring, velocity: Number.POSITIVE_INFINITY },
      ),
    ).toThrow(/finite number/);
    expect(() =>
      springTo(
        { x: 0 },
        {
          x: 100,
          spring,
          units: { x: 42 as unknown as string },
        },
      ),
    ).toThrow(/Unit for x must be a string/);
    expect(() =>
      springTo(
        { x: 0 },
        {
          x: 100,
          spring,
          adapters: {
            x: { read: 'now' } as unknown as {
              read: () => number;
              write: () => void;
            },
          },
        },
      ),
    ).toThrow(/must provide read and write functions/);
    expect(() =>
      springTo(
        { x: 0 },
        { x: 100, spring, onUpdate: 'later' as unknown as () => void },
      ),
    ).toThrow(/onUpdate must be a function/);
    expect(() =>
      springTo({ constructor: 0 }, { targets: { constructor: 100 }, spring }),
    ).toThrow(/Invalid spring property/);
  });

  it('accepts a selector only when GSAP resolves exactly one target', () => {
    const resolved = { x: 0 };
    mocks.gsap.utils.toArray.mockReturnValueOnce([resolved]);

    const controller = springTo('.item', { x: 100, spring });

    expect(mocks.gsap.getProperty).toHaveBeenCalledWith(
      resolved,
      'x',
      'native',
    );
    mocks.calls[0]!.vars.onComplete?.();
    expect(resolved.x).toBe(100);
    controller.kill();
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

  it('keeps the requested logical duration in continue mode', () => {
    const onLogicalComplete = vi.fn();
    const onUnsettled = vi.fn();
    const controller = springTo(
      { x: 0 },
      {
        x: 100,
        spring: { ...spring, damping: 0, settle: { maxDuration: 0.05 } },
        unsettled: 'continue',
        onLogicalComplete,
        onUnsettled,
      },
    );
    const call = mocks.calls[0]!;
    const logicalDuration = controller.springs.x!.timing.perceptualDuration;

    expect(logicalDuration).toBeGreaterThan(0.05);
    call.tween.totalTime.mockReturnValue(0.05);
    call.vars.onUpdate?.();
    expect(onUnsettled).toHaveBeenCalledOnce();
    expect(onLogicalComplete).not.toHaveBeenCalled();

    call.tween.totalTime.mockReturnValue(logicalDuration);
    call.vars.onUpdate?.();
    expect(onLogicalComplete).toHaveBeenCalledOnce();
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
