import { describe, expect, it, vi } from 'vitest';
import { createAdditiveSpringValue } from '../src/index.js';
import type { FrameDriver } from '../src/index.js';

class TestDriver implements FrameDriver {
  time = 0;
  private callbacks = new Set<(time: number) => void>();

  now(): number {
    return this.time;
  }

  schedule(callback: (time: number) => void): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  advance(time: number): void {
    this.time = time;
    const callbacks = [...this.callbacks];
    this.callbacks.clear();
    callbacks.forEach((callback) => callback(time));
  }
}

const parameters = { mass: 1, stiffness: 180, damping: 24 };

describe('additive SpringValue', () => {
  it('adds overlapping analytical contributions', () => {
    const driver = new TestDriver();
    const value = createAdditiveSpringValue(10, parameters, driver);

    value.animateBy(100);
    driver.advance(0.1);
    const firstPosition = value.get() - 10;
    const firstVelocity = value.getVelocity();

    value.animateBy(-40, { velocity: 20 });
    driver.advance(0.2);

    const isolated = new TestDriver();
    const positive = createAdditiveSpringValue(0, parameters, isolated);
    const negative = createAdditiveSpringValue(0, parameters, isolated);
    positive.animateBy(100);
    isolated.advance(0.1);
    negative.animateBy(-40, { velocity: 20 });
    isolated.advance(0.2);

    expect(firstPosition).toBeGreaterThan(0);
    expect(firstVelocity).toBeGreaterThan(0);
    expect(value.get()).toBeCloseTo(10 + positive.get() + negative.get(), 12);
    expect(value.getVelocity()).toBeCloseTo(
      positive.getVelocity() + negative.getVelocity(),
      12,
    );
    expect(value.getTarget()).toBe(70);
    expect(value.getSnapshot().contributions).toBe(2);
  });

  it('is deterministic across frame partitions and settles at the summed target', () => {
    const sparseDriver = new TestDriver();
    const denseDriver = new TestDriver();
    const sparse = createAdditiveSpringValue(5, parameters, sparseDriver);
    const dense = createAdditiveSpringValue(5, parameters, denseDriver);
    const settled = vi.fn();
    sparse.on('settle', settled);

    sparse.animateBy(100);
    sparse.animateBy(-25);
    dense.animateBy(100);
    dense.animateBy(-25);
    for (const time of [0.05, 0.1, 0.2, 0.4]) denseDriver.advance(time);
    sparseDriver.advance(0.4);

    expect(sparse.get()).toBeCloseTo(dense.get(), 12);
    expect(sparse.getVelocity()).toBeCloseTo(dense.getVelocity(), 12);

    sparseDriver.advance(5);
    expect(sparse.get()).toBe(80);
    expect(sparse.getVelocity()).toBe(0);
    expect(sparse.getSnapshot()).toEqual({
      value: 80,
      velocity: 0,
      target: 80,
      animating: false,
      contributions: 0,
    });
    expect(settled).toHaveBeenCalledOnce();
  });

  it('cancels one contribution without a position discontinuity', () => {
    const driver = new TestDriver();
    const value = createAdditiveSpringValue(0, parameters, driver);
    const first = value.animateBy(100);
    value.animateBy(50);
    driver.advance(0.2);
    const before = value.get();

    value.cancel(first);

    expect(value.get()).toBe(before);
    expect(value.getTarget()).toBeGreaterThan(before);
    expect(value.getSnapshot().contributions).toBe(1);
  });

  it('reports non-settlement once and remains under explicit lifecycle control', () => {
    const driver = new TestDriver();
    const value = createAdditiveSpringValue(
      0,
      { mass: 1, stiffness: 100, damping: 0 },
      driver,
      { settle: { maxDuration: 0.2 } },
    );
    const unsettled = vi.fn();
    value.on('unsettled', unsettled);
    value.animateBy(100);

    driver.advance(0.2);
    driver.advance(0.4);
    expect(unsettled).toHaveBeenCalledOnce();
    expect(value.getSnapshot().animating).toBe(true);

    const stoppedAt = value.get();
    value.stop();
    expect(value.get()).toBe(stoppedAt);
    expect(value.getVelocity()).toBe(0);
    expect(value.getSnapshot().animating).toBe(false);
  });

  it('supports jump, cancellation validation, and idempotent destruction', () => {
    const driver = new TestDriver();
    const value = createAdditiveSpringValue(0, parameters, driver);
    value.animateBy(100);
    value.jump(20);
    expect(value.getSnapshot()).toEqual({
      value: 20,
      velocity: 0,
      target: 20,
      animating: false,
      contributions: 0,
    });
    expect(() => value.cancel(0)).toThrow(RangeError);
    expect(() => value.animateBy(Number.NaN)).toThrow(RangeError);

    value.destroy();
    value.destroy();
    expect(() => value.animateBy(1)).toThrow(Error);
  });
});
