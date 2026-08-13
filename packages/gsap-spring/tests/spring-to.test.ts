import { beforeEach, describe, expect, it, vi } from 'vitest';

interface MockTweenVars {
  elapsed?: number;
  duration?: number;
  ease?: string;
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
    tween: { kill: ReturnType<typeof vi.fn> };
  }> = [];

  return {
    calls,
    gsap: {
      getProperty: vi.fn((target: Record<string, number>, property: string) => target[property]),
      quickSetter: vi.fn((target: Record<string, number>, property: string) => (value: number) => {
        target[property] = value;
      }),
      to: vi.fn((clock: MockClock, vars: MockTweenVars) => {
        const tween = { kill: vi.fn() };
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
});
