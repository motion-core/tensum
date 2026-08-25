import { beforeEach, describe, expect, it, vi } from 'vitest';

interface MockTweenVars {
  elapsed?: number;
  duration?: number;
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
      eventCallback: ReturnType<typeof vi.fn>;
      kill: ReturnType<typeof vi.fn>;
      pause: ReturnType<typeof vi.fn>;
      paused: ReturnType<typeof vi.fn>;
      play: ReturnType<typeof vi.fn>;
      resume: ReturnType<typeof vi.fn>;
      reverse: ReturnType<typeof vi.fn>;
      reversed: ReturnType<typeof vi.fn>;
      time: ReturnType<typeof vi.fn>;
      totalTime: ReturnType<typeof vi.fn>;
    };
  }> = [];

  return {
    calls,
    gsap: {
      utils: {
        toArray: vi.fn((target: unknown) =>
          target === null || target === undefined || typeof target === 'string'
            ? []
            : Array.isArray(target)
              ? target
              : [target],
        ),
      },
      getProperty: vi.fn(
        (target: Record<string, unknown>, property: string) => target[property],
      ),
      quickSetter: vi.fn(
        (target: Record<string, unknown>, property: string) =>
          (value: number) => {
            target[property] = value;
          },
      ),
      to: vi.fn((clock: MockClock, vars: MockTweenVars) => {
        let isPaused = false;
        let isReversed = false;
        let onInterrupt: (() => void) | undefined;
        const setLocalTime = (driverTime: number): void => {
          if (vars.repeat === -1) {
            clock.elapsed = driverTime;
            return;
          }
          const driverDuration = vars.duration ?? 0;
          const elapsedDuration = vars.elapsed ?? 0;
          clock.elapsed =
            driverDuration === 0
              ? elapsedDuration
              : Math.min(driverTime / driverDuration, 1) * elapsedDuration;
        };
        const tween = {
          eventCallback: vi.fn((type: string, callback?: () => void) => {
            if (type !== 'onInterrupt') return undefined;
            if (callback === undefined) return onInterrupt;
            onInterrupt = callback;
            return tween;
          }),
          kill: vi.fn(() => onInterrupt?.()),
          pause: vi.fn(() => {
            isPaused = true;
            return tween;
          }),
          paused: vi.fn(() => isPaused),
          play: vi.fn(() => {
            isPaused = false;
            return tween;
          }),
          resume: vi.fn(() => {
            isPaused = false;
            return tween;
          }),
          reverse: vi.fn(() => {
            isReversed = true;
            return tween;
          }),
          reversed: vi.fn(() => isReversed),
          time: vi.fn((value?: number) => {
            if (value === undefined) return clock.elapsed;
            setLocalTime(value);
            vars.onUpdate?.();
            return tween;
          }),
          totalTime: vi.fn((value?: number) => {
            if (value === undefined) return clock.elapsed;
            setLocalTime(value);
            vars.onUpdate?.();
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

function randomSequence(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return state >>> 0;
  };
}

describe('springTo deterministic stress', () => {
  beforeEach(() => {
    mocks.calls.length = 0;
    vi.clearAllMocks();
  });

  it('survives one thousand analytical handoffs without stale forward writes', () => {
    const target = { x: 0 };
    const random = randomSequence(0xc0ffee);
    const controllers = [] as ReturnType<typeof springTo>[];

    for (let index = 0; index < 1_000; index += 1) {
      const controller = springTo(target, {
        x: (random() % 2_001) - 1_000,
        spring,
      });
      controller.seek((random() / 0xffff_ffff) * controller.duration * 0.8);
      controllers.push(controller);
    }

    const terminal = controllers.at(-1)!;
    const terminalCall = mocks.calls.at(-1)!;
    terminalCall.vars.onComplete?.();
    const terminalPosition = target.x;

    for (let index = 0; index < controllers.length - 1; index += 1) {
      const call = mocks.calls[index]!;
      const previousTime = call.clock.elapsed;
      call.clock.elapsed = Math.min(
        previousTime + 0.01,
        controllers[index]!.duration,
      );
      call.vars.onUpdate?.();
      expect(target.x).toBe(terminalPosition);
    }

    terminal.kill();
    for (const controller of controllers.slice(0, -1)) controller.kill();
  });

  it('treats an external write after terminal completion as the next starting state', () => {
    const target = { x: 0 };
    const first = springTo(target, { x: 100, spring });
    mocks.calls[0]!.vars.onComplete?.();
    expect(target.x).toBe(100);

    target.x = -250;
    const second = springTo(target, { x: 50, spring });

    expect(second.springs.x!.stateAt(0)).toEqual({
      position: -250,
      velocity: 0,
    });
    second.seek(0.2);
    second.seek(0);
    expect(target.x).toBe(-250);

    second.kill();
    first.kill();
  });

  it('keeps random seek and playback controls finite and kill-idempotent', () => {
    const random = randomSequence(0x51a7e);

    for (let round = 0; round < 128; round += 1) {
      const target = { x: (random() % 1_000) - 500 };
      const controller = springTo(target, {
        x: (random() % 1_000) - 500,
        velocity: (random() % 2_000) - 1_000,
        spring,
      });
      const call = mocks.calls.at(-1)!;

      for (let step = 0; step < 64; step += 1) {
        switch (random() % 5) {
          case 0: {
            const time = (random() / 0xffff_ffff) * controller.duration;
            controller.seek(time);
            expect(target.x).toBeCloseTo(
              controller.springs.x!.positionAt(time),
              8,
            );
            break;
          }
          case 1:
            controller.pause();
            break;
          case 2:
            controller.resume();
            break;
          case 3:
            controller.play();
            break;
          default:
            controller.playbackReverse();
        }
        expect(Number.isFinite(target.x)).toBe(true);
      }

      const valueAtKill = target.x;
      controller.kill();
      controller.kill();
      controller.seek(controller.duration / 2);
      controller.play();
      controller.pause();
      controller.resume();
      controller.playbackReverse();
      expect(target.x).toBe(valueAtKill);
      expect(call.tween.kill).toHaveBeenCalledOnce();
    }
  });

  it.each(['stop', 'snap'] as const)(
    'keeps callback order deterministic at the %s completion boundary',
    (unsettled) => {
      const events: string[] = [];
      springTo(
        { x: 0 },
        {
          x: 100,
          spring: { ...spring, damping: 0, settle: { maxDuration: 0.01 } },
          unsettled,
          onUpdate: () => events.push('update'),
          onLogicalComplete: () => events.push('logical'),
          onUnsettled: () => events.push('unsettled'),
          onComplete: () => events.push('complete'),
        },
      );

      const call = mocks.calls[0]!;
      call.clock.elapsed = call.vars.elapsed!;
      call.vars.onUpdate?.();
      call.vars.onComplete?.();
      call.vars.onComplete?.();

      expect(events).toEqual(['update', 'logical', 'unsettled', 'complete']);
    },
  );

  it('keeps continue callbacks ordered without a driver completion', () => {
    const events: string[] = [];
    const controller = springTo(
      { x: 0 },
      {
        x: 100,
        spring: { ...spring, damping: 0, settle: { maxDuration: 0.01 } },
        unsettled: 'continue',
        onUpdate: () => events.push('update'),
        onLogicalComplete: () => events.push('logical'),
        onUnsettled: () => events.push('unsettled'),
        onComplete: () => events.push('complete'),
      },
    );
    const call = mocks.calls[0]!;
    const logicalDuration = controller.springs.x!.timing.perceptualDuration;

    call.tween.totalTime.mockReturnValue(0.01);
    call.vars.onUpdate?.();
    call.tween.totalTime.mockReturnValue(logicalDuration);
    call.vars.onUpdate?.();

    expect(events).toEqual(['update', 'unsettled', 'update', 'logical']);
    controller.kill();
  });

  it('rejects error policy before allocating a GSAP driver', () => {
    expect(() =>
      springTo(
        { x: 0 },
        {
          x: 100,
          spring: { ...spring, damping: 0, settle: { maxDuration: 0.01 } },
          unsettled: 'error',
        },
      ),
    ).toThrow(/cannot start an unsettled spring in error mode/);
    expect(mocks.gsap.to).not.toHaveBeenCalled();
  });

  it('rejects deterministic malformed maps and prototype-sensitive names', () => {
    const unsafeNames = ['__proto__', 'constructor', 'prototype'];
    for (const property of unsafeNames) {
      const targets = Object.create(null) as Record<string, number>;
      targets[property] = 1;
      expect(() =>
        springTo(
          { x: 0 },
          {
            targets,
            spring,
          },
        ),
      ).toThrow(/Invalid spring property/);
    }

    const invalidInputs = [
      { targets: { score: Number.NaN }, spring },
      { targets: { score: Number.POSITIVE_INFINITY }, spring },
      { targets: { score: 'calc(10px + 2%)' }, spring },
      { targets: [], spring },
      { targets: { score: 1 }, spring, velocity: { score: Number.NaN } },
      { targets: { score: 1 }, spring, adapters: { score: null } },
      { targets: { score: 1 }, spring, properties: { score: [] } },
    ];
    for (const vars of invalidInputs) {
      expect(() => springTo({ score: 0 }, vars as never)).toThrow();
    }
  });
});
