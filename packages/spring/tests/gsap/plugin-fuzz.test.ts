import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { gsap } from 'gsap';
import {
  createMotionSpringTween,
  createSpring,
  registerMotionCoreSpringPlugin,
} from '../../src/index.js';
import type { MotionSpringEffectVars } from '../../src/index.js';

const parameters = {
  mass: 1,
  stiffness: 180,
  damping: 24,
  settle: { position: 0.001, velocity: 0.001 },
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

function shuffled<Value>(
  values: readonly Value[],
  random: () => number,
): Value[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const nextIndex = random() % (index + 1);
    [result[index], result[nextIndex]] = [result[nextIndex]!, result[index]!];
  }
  return result;
}

function expectFiniteTargets(
  targets: readonly Record<string, unknown>[],
  properties: readonly string[],
): void {
  for (const target of targets) {
    for (const property of properties) {
      expect(Number.isFinite(Number.parseFloat(String(target[property])))).toBe(
        true,
      );
    }
  }
}

beforeAll(() => {
  registerMotionCoreSpringPlugin(gsap);
  gsap.ticker.sleep();
});

afterEach(() => {
  gsap.globalTimeline.clear();
  gsap.ticker.sleep();
});

describe('MotionCoreSpringPlugin deterministic fuzz', () => {
  it('stays finite through adversarial multi-target seek, reverse, yoyo, and invalidate', () => {
    const random = randomSequence(0xa11ce);
    const targets = Array.from({ length: 6 }, (_, index) => ({
      score: index * 20,
      normal: index,
      opacity: 1,
    }));
    const onUpdate = vi.fn();
    const onRepeat = vi.fn();
    const onComplete = vi.fn();
    const lifecycleSnapshots: unknown[] = [];
    const tween = createMotionSpringTween(targets, {
      values: { score: 200 },
      parameters,
      onLogicalComplete: (snapshot) => lifecycleSnapshots.push(snapshot),
      onSettle: (snapshot) => lifecycleSnapshots.push(snapshot),
      tween: {
        paused: true,
        repeat: 2,
        repeatDelay: 0.025,
        yoyo: true,
        normal: 80,
        opacity: 0.25,
        onUpdate,
        onRepeat,
        onComplete,
      },
    });
    const duration = tween.duration();
    const totalDuration = tween.totalDuration();

    for (let step = 0; step < 1_000; step += 1) {
      switch (random() % 6) {
        case 0:
          tween.totalTime((random() / 0xffff_ffff) * totalDuration, false);
          break;
        case 1:
          tween.time((random() / 0xffff_ffff) * duration, false);
          break;
        case 2:
          tween.reverse().pause();
          break;
        case 3:
          tween.play().pause();
          break;
        case 4:
          tween
            .invalidate()
            .totalTime((random() / 0xffff_ffff) * totalDuration, false);
          break;
        default:
          tween.paused(!tween.paused());
      }

      expect(tween.duration()).toBe(duration);
      expect(tween.repeat()).toBe(2);
      expectFiniteTargets(targets, ['score', 'normal', 'opacity']);
    }

    tween.totalTime(totalDuration, false);
    expect(onUpdate).toHaveBeenCalled();
    expect(onRepeat).toHaveBeenCalled();
    expect(onComplete).toHaveBeenCalled();
    for (const snapshot of lifecycleSnapshots) {
      const typed = snapshot as {
        elapsed: number;
        duration: number;
        states: Record<string, { position: number; velocity: number }>;
      };
      expect(Number.isFinite(typed.elapsed)).toBe(true);
      expect(Number.isFinite(typed.duration)).toBe(true);
      expect(Number.isFinite(typed.states['score']!.position)).toBe(true);
      expect(Number.isFinite(typed.states['score']!.velocity)).toBe(true);
    }

    tween.kill();
  });

  it('keeps killed properties frozen and restores host timing after the final participant', () => {
    const random = randomSequence(0xc1ea4);
    const targets = Array.from({ length: 5 }, (_, index) => ({
      score: index * 10,
      drift: index * -5,
      opacity: 1,
    }));
    const hostDuration = 0.37;
    const hostRepeat = 2;
    const tween = gsap.to(targets, {
      paused: true,
      duration: hostDuration,
      repeat: hostRepeat,
      yoyo: true,
      opacity: 0.2,
      motionSpring: {
        values: { score: 100, drift: 50 },
        parameters,
        properties: {
          drift: { damping: 0, settle: { maxDuration: 0.15 } },
        },
        unsettled: 'continue',
      },
    });

    tween.totalTime(0.01, true);
    expect(tween.duration()).toBe(1);
    expect(tween.repeat()).toBe(-1);
    tween.invalidate().totalTime(0.03, true);
    expect(tween.repeat()).toBe(-1);

    const frozen = new Map<string, number>();
    for (const property of ['drift', 'score'] as const) {
      const shuffledTargets = shuffled(targets, random);
      for (const target of shuffledTargets) {
        tween.kill(target, property);
        const key = `${targets.indexOf(target)}:${property}`;
        frozen.set(key, target[property]);
        tween.time((random() / 0xffff_ffff) * tween.duration(), true);

        for (const [frozenKey, value] of frozen) {
          const [targetIndex, frozenProperty] = frozenKey.split(':') as [
            string,
            'drift' | 'score',
          ];
          expect(targets[Number(targetIndex)]![frozenProperty]).toBe(value);
        }
        expectFiniteTargets(targets, ['score', 'drift', 'opacity']);
      }

      if (property === 'drift') {
        expect(tween.repeat()).toBe(hostRepeat);
        expect(tween.duration()).toBeGreaterThan(hostDuration);
      }
    }

    expect(tween.repeat()).toBe(hostRepeat);
    expect(tween.duration()).toBe(hostDuration);
    tween.totalTime(tween.totalDuration(), true);
    expect(targets.map((target) => target.opacity)).toEqual(
      targets.map(() => 0.2),
    );

    for (const target of targets) {
      tween.kill(target, 'score');
      tween.kill(target, 'drift');
    }
    expect(tween.repeat()).toBe(hostRepeat);
    expect(tween.duration()).toBe(hostDuration);
    tween.kill();
    tween.kill();
  });

  it('rebuilds a target-scoped property kill from its current value after invalidate', () => {
    const targets = [{ score: 0 }, { score: 20 }];
    const hostDuration = 0.25;
    const tween = gsap.to(targets, {
      paused: true,
      duration: hostDuration,
      motionSpring: {
        values: { score: 100 },
        parameters,
      },
    });

    tween.time(0.05, true);
    tween.kill(targets[0], 'score');
    const killedValue = targets[0]!.score;
    const liveValue = targets[1]!.score;

    tween.invalidate().time(0.01, true);
    tween.time(0.2, true);

    expect(targets[0]!.score).toBeCloseTo(
      createSpring({
        from: killedValue,
        to: 100,
        velocity: 0,
        ...parameters,
      }).positionAt(0.2),
      10,
    );
    expect(targets[1]!.score).not.toBe(liveValue);
    expect(Number.isFinite(targets[1]!.score)).toBe(true);
    tween.kill(targets[0], 'score');
    tween.kill(targets[1], 'score');
    expect(tween.duration()).toBe(hostDuration);
  });

  it('does not replay covered history after hundreds of multi-target handoffs', () => {
    const random = randomSequence(0x0badf00d);
    const targets = Array.from({ length: 8 }, (_, index) => ({ score: index }));
    const layers: gsap.core.Tween[] = [];

    for (let layer = 0; layer < 256; layer += 1) {
      const tween = gsap.to(targets, {
        paused: true,
        motionSpring: {
          values: { score: (random() % 2_001) - 1_000 },
          parameters,
        },
      });
      tween.time(0.02, true);
      layers.push(tween);
    }

    const terminal = layers.at(-1)!;
    terminal.time(terminal.duration(), true);
    const terminalValues = targets.map((target) => target.score);

    for (const older of layers.slice(0, -1)) {
      older.time(0.03, true);
      expect(targets.map((target) => target.score)).toEqual(terminalValues);
    }

    terminal.reverse().time(0, true);
    expectFiniteTargets(targets, ['score']);
    terminal.kill();
    for (const older of layers.slice(0, -1)) older.kill();
  });

  it('ignores inherited configuration fields and prototype-backed maps', () => {
    const inheritedLazy = Object.assign(Object.create({ x: 100 }), {
      parameters,
    });
    const lazyTarget = { x: 0 };
    const lazyTween = gsap.to(lazyTarget, {
      paused: true,
      motionSpring: inheritedLazy,
    });
    expect(() => lazyTween.time(0.01, true)).toThrow(
      /requires at least one numeric target property/,
    );
    expect(lazyTarget.x).toBe(0);

    const inheritedFrom = Object.assign(
      Object.create({ from: { score: 900 } }),
      {
        values: { score: 100 },
        parameters,
        tween: { paused: true },
      },
    ) as MotionSpringEffectVars;
    const fromTarget = { score: 0 };
    const fromTween = createMotionSpringTween(fromTarget, inheritedFrom);
    fromTween.time(0.05, true);
    expect(fromTarget.score).toBeCloseTo(
      createSpring({ from: 0, to: 100, velocity: 0, ...parameters }).positionAt(
        0.05,
      ),
      10,
    );

    const inheritedProperties = Object.create({
      score: { velocity: 10_000 },
    }) as Record<string, { velocity: number }>;
    const propertyTarget = { score: 0 };
    const propertyTween = createMotionSpringTween(propertyTarget, {
      values: { score: 100 },
      parameters,
      properties: inheritedProperties,
      tween: { paused: true },
    });
    propertyTween.time(0.05, true);
    expect(propertyTarget.score).toBeCloseTo(
      createSpring({ from: 0, to: 100, velocity: 0, ...parameters }).positionAt(
        0.05,
      ),
      10,
    );
  });

  it('rejects malformed and prototype-sensitive values before they can write', () => {
    for (const property of ['__proto__', 'constructor', 'prototype']) {
      const values = Object.create(null) as Record<string, number>;
      values[property] = 1;
      expect(() =>
        createMotionSpringTween(
          { score: 0 },
          { values, parameters, tween: { paused: true } },
        ),
      ).toThrow(/Invalid spring property/);
    }

    const invalid = [
      ['NaN target', { values: { score: Number.NaN }, parameters }],
      [
        'infinite target',
        { values: { score: Number.POSITIVE_INFINITY }, parameters },
      ],
      ['complex target', { values: { score: 'calc(1px + 2%)' }, parameters }],
      [
        'array properties',
        { values: { score: 1 }, parameters, properties: [] },
      ],
      [
        'non-string unit',
        { values: { score: 1 }, parameters, units: { score: 42 } },
      ],
      [
        'null adapter',
        { values: { score: 1 }, parameters, adapters: { score: null } },
      ],
      [
        'non-function callback',
        { values: { score: 1 }, parameters, onSettle: 'later' },
      ],
    ] as const;
    for (const [name, vars] of invalid) {
      const target = { score: 0 };
      expect(
        () =>
          createMotionSpringTween(target, {
            ...vars,
            tween: { paused: true },
          } as never),
        name,
      ).toThrow();
      expect(target.score).toBe(0);
    }
  });

  it('cleans repeated invalidation and interruption exactly once', () => {
    const targets = [{ score: 10 }, { score: 20 }, { score: 30 }];
    const onInterrupt = vi.fn();
    const tween = gsap.to(targets, {
      paused: true,
      onInterrupt,
      motionSpring: {
        values: { score: 100 },
        parameters,
      },
    });

    for (let generation = 0; generation < 100; generation += 1) {
      tween.invalidate().time(0.01 + (generation % 10) * 0.001, true);
      expectFiniteTargets(targets, ['score']);
    }
    const valuesAtKill = targets.map((target) => target.score);

    tween.kill();
    tween.kill();
    tween.time(0.2, true);

    expect(onInterrupt).toHaveBeenCalledOnce();
    expect(targets.map((target) => target.score)).toEqual(valuesAtKill);
  });
});
