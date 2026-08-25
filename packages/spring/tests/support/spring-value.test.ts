import { describe, expect, it, vi } from 'vitest';
import { createSpring, createSpringValue } from '../../src/index.js';
import type { FrameDriver } from '../../src/index.js';

class ManualFrameDriver implements FrameDriver {
  #time = 0;
  #callbacks = new Set<(time: number) => void>();

  now(): number {
    return this.#time;
  }

  schedule(callback: (time: number) => void): () => void {
    this.#callbacks.add(callback);
    return (): void => {
      this.#callbacks.delete(callback);
    };
  }

  step(deltaTime: number): void {
    this.#time += deltaTime;
    const callbacks = [...this.#callbacks];
    this.#callbacks.clear();
    for (const callback of callbacks) callback(this.#time);
  }

  get pendingFrames(): number {
    return this.#callbacks.size;
  }
}

const parameters = { mass: 1, stiffness: 180, damping: 24 } as const;

describe('SpringValue', () => {
  it('animates with an injected frame driver and settles exactly at its target', () => {
    const driver = new ManualFrameDriver();
    const value = createSpringValue(0, parameters, driver);
    const onChange = vi.fn();
    const onSettle = vi.fn();
    value.on('change', onChange);
    value.on('settle', onSettle);

    value.setTarget(500);
    driver.step(0);
    driver.step(0.2);
    expect(value.get()).toBeGreaterThan(0);
    expect(value.get()).toBeLessThan(500);
    expect(value.getVelocity()).toBeGreaterThan(0);

    for (let frame = 0; frame < 600 && value.getSnapshot().animating; frame += 1) {
      driver.step(1 / 60);
    }

    expect(value.get()).toBe(500);
    expect(value.getVelocity()).toBe(0);
    expect(onChange).toHaveBeenCalled();
    expect(onSettle).toHaveBeenCalledOnce();
    expect(driver.pendingFrames).toBe(0);
  });

  it('batches targets in one frame and preserves analytical velocity on retarget', () => {
    const driver = new ManualFrameDriver();
    const value = createSpringValue(0, parameters, driver);

    value.setTarget(100);
    value.setTarget(200);
    value.setTarget(300);
    expect(value.getTarget()).toBe(300);
    driver.step(0);
    driver.step(0.2);
    const position = value.get();
    const velocity = value.getVelocity();

    value.setTarget(50);
    driver.step(0);
    expect(value.get()).toBe(position);
    expect(value.getVelocity()).toBe(velocity);
    expect(value.getTarget()).toBe(50);
  });

  it('is deterministic across different frame partitions', () => {
    const coarseDriver = new ManualFrameDriver();
    const fineDriver = new ManualFrameDriver();
    const coarse = createSpringValue(0, parameters, coarseDriver);
    const fine = createSpringValue(0, parameters, fineDriver);

    coarse.setTarget(500);
    fine.setTarget(500);
    coarseDriver.step(0);
    fineDriver.step(0);
    coarseDriver.step(0.5);
    for (let frame = 0; frame < 30; frame += 1) fineDriver.step(1 / 60);

    expect(coarse.get()).toBeCloseTo(fine.get(), 12);
    expect(coarse.getVelocity()).toBeCloseTo(fine.getVelocity(), 12);
  });

  it('emits logical completion before physical settlement', () => {
    const driver = new ManualFrameDriver();
    const value = createSpringValue(0, parameters, driver, {
      timing: { perceptualDuration: 0.1 },
    });
    const events: string[] = [];
    value.on('logicalComplete', () => events.push('logical'));
    value.on('settle', () => events.push('settle'));

    value.setTarget(500);
    driver.step(0);
    driver.step(0.11);
    expect(events).toEqual(['logical']);

    for (let frame = 0; frame < 600 && value.getSnapshot().animating; frame += 1) {
      driver.step(1 / 60);
    }
    expect(events).toEqual(['logical', 'settle']);
  });

  it('continues an undamped spring and reports the configured unsettled boundary once', () => {
    const driver = new ManualFrameDriver();
    const value = createSpringValue(0, { ...parameters, damping: 0 }, driver, {
      settle: { maxDuration: 0.2 },
    });
    const onUnsettled = vi.fn();
    value.on('unsettled', onUnsettled);

    value.setTarget(100);
    driver.step(0);
    driver.step(0.2);
    const first = value.get();
    expect(onUnsettled).toHaveBeenCalledOnce();
    expect(value.getSnapshot().animating).toBe(true);

    driver.step(0.1);
    expect(value.get()).not.toBe(first);
    expect(onUnsettled).toHaveBeenCalledOnce();
  });

  it('supports stop, jump, unsubscribe, and idempotent destruction', () => {
    const driver = new ManualFrameDriver();
    const value = createSpringValue(0, parameters, driver);
    const onChange = vi.fn();
    const unsubscribe = value.on('change', onChange);

    value.setTarget(500);
    driver.step(0);
    driver.step(0.2);
    value.stop();
    const stopped = value.get();
    expect(value.getVelocity()).toBe(0);
    expect(value.getTarget()).toBe(stopped);
    expect(value.getSnapshot().animating).toBe(false);

    unsubscribe();
    unsubscribe();
    value.jump(42);
    expect(value.get()).toBe(42);
    expect(value.getVelocity()).toBe(0);

    value.destroy();
    value.destroy();
    value.setTarget(100);
    expect(value.get()).toBe(42);
    expect(driver.pendingFrames).toBe(0);
  });

  it('allows change listeners to retarget without completing the interrupted spring', () => {
    const driver = new ManualFrameDriver();
    const value = createSpringValue(0, parameters, driver);
    const onSettle = vi.fn();
    let retargeted = false;
    value.on('settle', onSettle);
    value.on('change', () => {
      if (!retargeted) {
        retargeted = true;
        value.setTarget(200);
      }
    });

    value.setTarget(100);
    driver.step(0);
    driver.step(0.1);
    driver.step(0);

    expect(value.getTarget()).toBe(200);
    expect(onSettle).not.toHaveBeenCalled();
  });

  it('retargets with new spring parameters without losing state', () => {
    const driver = new ManualFrameDriver();
    const value = createSpringValue(0, parameters, driver);
    const nextParameters = { mass: 2, stiffness: 90, damping: 18 };

    value.setTarget(300);
    driver.step(0);
    driver.step(0.2);
    const position = value.get();
    const velocity = value.getVelocity();
    value.setTarget(100, { parameters: nextParameters });
    driver.step(0);

    expect(value.get()).toBe(position);
    expect(value.getVelocity()).toBe(velocity);
    expect(value.getParameters()).toEqual(nextParameters);

    const expected = createSpring({
      from: position,
      to: 100,
      velocity,
      ...nextParameters,
    });
    driver.step(0.1);
    expect(value.get()).toBeCloseTo(expected.positionAt(0.1), 12);
    expect(value.getVelocity()).toBeCloseTo(expected.velocityAt(0.1), 12);
  });

  it('changes parameters for the current target through setParameters', () => {
    const driver = new ManualFrameDriver();
    const value = createSpringValue(0, parameters, driver);
    const nextParameters = { mass: 1, stiffness: 320, damping: 30 };

    value.setTarget(300);
    driver.step(0);
    driver.step(0.1);
    const before = value.get();
    value.setParameters(nextParameters);
    driver.step(0);

    expect(value.get()).toBe(before);
    expect(value.getTarget()).toBe(300);
    expect(value.getParameters()).toEqual(nextParameters);
  });

  it('blends parameter changes with position and velocity continuity', () => {
    const driver = new ManualFrameDriver();
    const value = createSpringValue(0, parameters, driver);
    const nextParameters = { mass: 1, stiffness: 80, damping: 10 };
    const blendDuration = 0.4;
    const previous = createSpring({ from: 0, to: 100, velocity: 0, ...parameters });
    const next = createSpring({
      from: 0,
      to: 100,
      velocity: 0,
      ...nextParameters,
    });

    value.setTarget(100, { parameters: nextParameters, blendDuration });
    driver.step(0);
    expect(value.get()).toBe(0);
    expect(value.getVelocity()).toBe(0);

    driver.step(blendDuration / 2);
    const previousState = previous.stateAt(blendDuration / 2);
    const nextState = next.stateAt(blendDuration / 2);
    const weight = 0.5;
    const weightVelocity = 3.75;
    expect(value.get()).toBeCloseTo(
      previousState.position + (nextState.position - previousState.position) * weight,
      12,
    );
    expect(value.getVelocity()).toBeCloseTo(
      previousState.velocity +
        (nextState.velocity - previousState.velocity) * weight +
        (nextState.position - previousState.position) * weightVelocity,
      12,
    );

    driver.step(blendDuration / 2);
    expect(value.get()).toBeCloseTo(next.positionAt(blendDuration), 12);
    expect(value.getVelocity()).toBeCloseTo(next.velocityAt(blendDuration), 12);
  });

  it('keeps parameter blending deterministic across frame partitions', () => {
    const coarseDriver = new ManualFrameDriver();
    const fineDriver = new ManualFrameDriver();
    const nextParameters = { mass: 1, stiffness: 80, damping: 10 };
    const coarse = createSpringValue(0, parameters, coarseDriver);
    const fine = createSpringValue(0, parameters, fineDriver);

    coarse.setTarget(100, { parameters: nextParameters, blendDuration: 0.4 });
    fine.setTarget(100, { parameters: nextParameters, blendDuration: 0.4 });
    coarseDriver.step(0);
    fineDriver.step(0);
    coarseDriver.step(0.3);
    for (let frame = 0; frame < 18; frame += 1) fineDriver.step(1 / 60);

    expect(coarse.get()).toBeCloseTo(fine.get(), 12);
    expect(coarse.getVelocity()).toBeCloseTo(fine.getVelocity(), 12);
  });

  it('rejects invalid parameter blend durations', () => {
    const value = createSpringValue(0, parameters, new ManualFrameDriver());

    expect(() => value.setTarget(100, { blendDuration: -1 })).toThrow(RangeError);
    expect(() =>
      value.setTarget(100, { blendDuration: Number.NaN }),
    ).toThrow(RangeError);
  });

  it('rejects explicit null retarget options instead of using pending defaults', () => {
    const driver = new ManualFrameDriver();
    const value = createSpringValue(0, parameters, driver);

    expect(() => value.setTarget(1, { parameters: null as never })).toThrow(
      TypeError,
    );
    expect(() => value.setTarget(1, { blendDuration: null as never })).toThrow(
      RangeError,
    );
  });

  it('cannot be reactivated by a change listener during destruction', () => {
    const driver = new ManualFrameDriver();
    const value = createSpringValue(0, parameters, driver);

    value.setTarget(100);
    driver.step(0);
    driver.step(0.1);
    value.on('change', () => value.setTarget(200));

    value.destroy();

    expect(value.getSnapshot().animating).toBe(false);
    expect(driver.pendingFrames).toBe(0);
  });

  it('rejects an invalid timing object at construction', () => {
    expect(() =>
      createSpringValue(0, parameters, new ManualFrameDriver(), {
        timing: null as never,
      }),
    ).toThrow(TypeError);
  });
});
