import { describe, expect, it, vi } from 'vitest';
import { createSpringValue } from '../src/index.js';
import type { FrameDriver } from '../src/index.js';

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
});
