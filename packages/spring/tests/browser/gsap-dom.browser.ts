import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { gsap } from 'gsap';
import {
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

function createTarget(): HTMLDivElement {
  const target = document.createElement('div');
  target.style.width = '100px';
  target.style.height = '100px';
  document.body.append(target);
  gsap.set(target, { x: 0, y: 0, scale: 1, rotation: 0 });
  return target;
}

function numericProperty(
  target: HTMLElement,
  property: 'x' | 'y' | 'scale' | 'rotation',
): number {
  return Number.parseFloat(String(gsap.getProperty(target, property)));
}

beforeAll(() => {
  registerSpringPlugin(gsap);
  gsap.ticker.sleep();
});

afterEach(() => {
  gsap.globalTimeline.clear();
  gsap.ticker.sleep();
  document.body.replaceChildren();
});

describe('GSAP browser integration', () => {
  it('writes multi-property transforms through CSSPlugin with px and deg units', () => {
    const target = createTarget();
    const tween = gsap.to(target, {
      paused: true,
      motionSpring: {
        x: '120px',
        y: '-80px',
        rotation: '90deg',
        parameters,
      },
    });

    tween.time(0.01, true);
    expect(tween.duration()).toBeGreaterThan(0.01);
    tween.time(tween.duration(), true);

    expect(numericProperty(target, 'x')).toBeCloseTo(120, 6);
    expect(numericProperty(target, 'y')).toBeCloseTo(-80, 6);
    expect(numericProperty(target, 'rotation')).toBeCloseTo(90, 6);
    expect(target.style.transform).toContain('translate(120px, -80px)');
    expect(getComputedStyle(target).transform).not.toBe('none');

    tween.kill();
  });

  // Remove `.fails` when the DOM writer expands GSAP's `scale` alias to
  // separate `scaleX` and `scaleY` setters.
  it.fails('writes scale through the CSSPlugin transform cache', () => {
    const target = createTarget();
    const tween = gsap.to(target, {
      paused: true,
      motionSpring: {
        scale: 1.75,
        parameters,
      },
    });

    tween.time(0.01, true);
    tween.time(tween.duration(), true);

    expect(numericProperty(target, 'scale')).toBeCloseTo(1.75, 6);

    tween.kill();
  });

  it('keeps DOM output deterministic across seek and reverse', () => {
    const target = createTarget();
    const tween = gsap.to(target, {
      paused: true,
      motionSpring: {
        x: '240px',
        rotation: '45deg',
        parameters,
      },
    });

    tween.time(0.01, true);
    const duration = tween.duration();
    const sampleTime = duration * 0.28;
    tween.time(duration * 0.8, true);
    tween.time(sampleTime, true);
    const rewoundX = numericProperty(target, 'x');
    const rewoundRotation = numericProperty(target, 'rotation');

    tween.time(duration * 0.8, true);
    tween.reverse().pause();
    tween.time(sampleTime, true);

    expect(tween.reversed()).toBe(true);
    expect(numericProperty(target, 'x')).toBeCloseTo(rewoundX, 8);
    expect(numericProperty(target, 'rotation')).toBeCloseTo(rewoundRotation, 8);

    tween.kill();
  });

  it('restores DOM transforms on context revert and freezes a killed controller', () => {
    const target = createTarget();
    gsap.set(target, { x: 25, rotation: 10 });
    let tween: gsap.core.Tween | undefined;
    const context = gsap.context(() => {
      tween = gsap.to(target, {
        paused: true,
        motionSpring: {
          x: '180px',
          rotation: '70deg',
          parameters,
        },
      });
    });

    tween!.time(0.2, true);
    expect(numericProperty(target, 'x')).not.toBeCloseTo(25, 6);
    context.revert();
    expect(numericProperty(target, 'x')).toBeCloseTo(25, 6);
    expect(numericProperty(target, 'rotation')).toBeCloseTo(10, 6);

    const controller = springTo(target, { x: '200px', spring: parameters });
    controller.pause();
    controller.seek(0.2);
    const atKill = numericProperty(target, 'x');
    controller.kill();
    controller.seek(0.5);

    expect(numericProperty(target, 'x')).toBeCloseTo(atKill, 8);
  });

  it('preserves analytical velocity from motionSpring to springTo', () => {
    const target = createTarget();
    const handoffTime = 0.2;
    const sampleTime = 0.08;
    const firstSolution = createSpring({
      from: 0,
      to: 100,
      velocity: 300,
      ...parameters,
    });
    const first = gsap.to(target, {
      paused: true,
      motionSpring: {
        x: '100px',
        velocity: { x: 300 },
        parameters,
      },
    });

    first.time(handoffTime, true);
    const inherited = firstSolution.stateAt(handoffTime);
    const redirected = springTo(target, {
      x: '-50px',
      velocity: { x: -999 },
      spring: parameters,
    });
    redirected.pause();

    expect(redirected.springs.x!.positionAt(0)).toBeCloseTo(
      inherited.position,
      8,
    );
    expect(redirected.springs.x!.velocityAt(0)).toBeCloseTo(
      inherited.velocity,
      8,
    );

    const expected = createSpring({
      from: inherited.position,
      to: -50,
      velocity: inherited.velocity,
      ...parameters,
    });
    redirected.seek(sampleTime);
    expect(numericProperty(target, 'x')).toBeCloseTo(
      expected.positionAt(sampleTime),
      7,
    );

    redirected.kill();
    first.kill();
  });

  it('preserves analytical velocity from springTo to motionSpring', () => {
    const target = createTarget();
    const handoffTime = 0.2;
    const sampleTime = 0.08;
    const first = springTo(target, {
      x: '100px',
      velocity: { x: 250 },
      spring: parameters,
    });
    first.pause();
    first.seek(handoffTime);
    const inherited = first.getSnapshot().states.x!;
    const expected = createSpring({
      from: inherited.position,
      to: -50,
      velocity: inherited.velocity,
      ...parameters,
    });
    const redirected = gsap.to(target, {
      paused: true,
      motionSpring: {
        x: '-50px',
        velocity: { x: -999 },
        parameters,
      },
    });

    redirected.time(sampleTime, true);

    expect(numericProperty(target, 'x')).toBeCloseTo(
      expected.positionAt(sampleTime),
      7,
    );

    redirected.kill();
    first.kill();
  });

  // Remove `.fails` when the DOM reader preserves CSSPlugin's native unit.
  it.fails(
    'rejects incompatible CSS units before starting a controller',
    () => {
      const target = createTarget();
      target.style.width = '100px';

      expect(() =>
        springTo(target, {
          targets: { width: '20deg' },
          spring: parameters,
        }),
      ).toThrowError(/Unit mismatch for width/);
    },
  );
});
