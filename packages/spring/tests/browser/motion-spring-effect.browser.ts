import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { gsap } from 'gsap';
import {
  createMotionSpringTween,
  createSpring,
  registerSpringPlugin,
} from '../../src/index.js';

const parameters = {
  mass: 1,
  stiffness: 180,
  damping: 24,
  settle: { position: 0.001, velocity: 0.001 },
};

function createElement(initial: gsap.TweenVars = {}): HTMLDivElement {
  const target = document.createElement('div');
  target.style.setProperty('--reveal', '0%');
  target.style.opacity = '0.25';
  document.body.append(target);
  gsap.set(target, { x: 0, y: 0, scale: 1, rotation: 0, ...initial });
  return target;
}

function numericProperty(
  target: Element,
  property: 'x' | 'y' | 'scale' | 'rotation' | 'opacity',
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

describe('motionSpring effect in a real browser', () => {
  it('sequences preflighted DOM effects from an explicit future state', () => {
    const target = createElement();
    const firstSpring = createSpring({
      from: 0,
      to: 100,
      velocity: 0,
      ...parameters,
    });
    const secondSpring = createSpring({
      from: 100,
      to: 240,
      velocity: 0,
      ...parameters,
    });
    const timeline = gsap.timeline({ paused: true });

    timeline
      .motionSpring(target, {
        x: '100px',
        from: { x: '0px' },
        parameters,
      })
      .motionSpring(target, {
        x: '240px',
        from: { x: '100px' },
        parameters,
      });

    const [first, second] = timeline.getChildren(
      false,
      true,
      false,
    ) as gsap.core.Tween[];

    expect(first!.duration()).toBeCloseTo(firstSpring.getSettlingDuration(), 6);
    expect(second!.startTime()).toBeCloseTo(first!.endTime(false), 7);
    expect(second!.duration()).toBeCloseTo(
      secondSpring.getSettlingDuration(),
      6,
    );

    timeline.time(first!.duration() + 0.08, true);
    expect(numericProperty(target, 'x')).toBeCloseTo(
      secondSpring.positionAt(0.08),
      7,
    );

    timeline.time(timeline.duration(), true);
    expect(numericProperty(target, 'x')).toBeCloseTo(240, 6);

    timeline.kill();
  });

  it('stagger-animates an array of real elements through CSSPlugin', () => {
    const targets = [0, 20, -30].map((x) => createElement({ x }));
    const springs = [0, 20, -30].map((from) =>
      createSpring({ from, to: 100, velocity: 0, ...parameters }),
    );
    const driverDuration = Math.max(
      ...springs.map((spring) => spring.getSettlingDuration()),
    );
    const timeline = gsap.timeline({ paused: true });

    timeline.motionSpring(targets, {
      x: '100px',
      parameters,
      tween: { stagger: 0.15 },
    });

    expect(timeline.duration()).toBeCloseTo(driverDuration + 0.3, 6);
    timeline.time(timeline.duration(), true);

    for (const target of targets) {
      expect(numericProperty(target, 'x')).toBeCloseTo(100, 6);
      expect(getComputedStyle(target).transform).not.toBe('none');
    }

    timeline.kill();
  });

  it('preserves nested duration across repeat and yoyo playback', () => {
    const target = createElement();
    const spring = createSpring({
      from: 0,
      to: 90,
      velocity: 0,
      ...parameters,
    });
    const child = gsap.timeline();

    child.motionSpring(target, {
      rotation: '90deg',
      from: { rotation: '0deg' },
      parameters,
      tween: { repeat: 1, yoyo: true },
    });

    const effect = child.getChildren(false, true, false)[0] as gsap.core.Tween;
    const parent = gsap.timeline({ paused: true }).add(child, 0.2);
    const effectDuration = effect.duration();

    expect(effectDuration).toBeCloseTo(spring.getSettlingDuration(), 6);
    expect(effect.totalDuration()).toBeCloseTo(effectDuration * 2, 6);
    expect(parent.duration()).toBeCloseTo(0.2 + effect.totalDuration(), 7);

    parent.time(0.2 + effectDuration, true);
    expect(numericProperty(target, 'rotation')).toBeCloseTo(90, 6);
    parent.time(parent.duration(), true);
    expect(numericProperty(target, 'rotation')).toBeCloseTo(0, 6);

    parent.kill();
  });

  it('creates a directly controllable multi-property DOM tween', () => {
    const target = createElement({ x: 10 });
    const tween = createMotionSpringTween(target, {
      x: '80px',
      values: { opacity: 0.8, '--reveal': '100%' },
      from: { x: '10px', opacity: 0.25, '--reveal': '0%' },
      parameters,
      tween: { paused: true },
    });
    const durationBeforeRender = tween.duration();

    expect(durationBeforeRender).toBeGreaterThan(0);
    tween.time(durationBeforeRender, true);

    expect(tween.duration()).toBe(durationBeforeRender);
    expect(numericProperty(target, 'x')).toBeCloseTo(80, 6);
    expect(Number.parseFloat(getComputedStyle(target).opacity)).toBeCloseTo(
      0.8,
      6,
    );
    expect(
      Number.parseFloat(target.style.getPropertyValue('--reveal')),
    ).toBeCloseTo(100, 6);

    tween.kill();
  });

  it('uses a custom adapter while the browser owns the target element', () => {
    const target = createElement();
    target.dataset['progress'] = '0';
    const progress = createSpring({
      from: 0,
      to: 1,
      velocity: 0,
      ...parameters,
    });
    const tween = createMotionSpringTween(target, {
      values: { progress: 1 },
      from: { progress: 0 },
      parameters,
      adapters: {
        progress: {
          read: (element) =>
            Number.parseFloat(
              (element as HTMLElement).dataset['progress'] ?? '0',
            ),
          write: (element, value) => {
            (element as HTMLElement).dataset['progress'] = String(value);
          },
        },
      },
      tween: { paused: true },
    });

    tween.time(0.12, true);
    expect(Number.parseFloat(target.dataset['progress']!)).toBeCloseTo(
      progress.positionAt(0.12),
      9,
    );
    tween.time(tween.duration(), true);
    expect(Number.parseFloat(target.dataset['progress']!)).toBeCloseTo(1, 9);

    tween.kill();
  });

  it('writes transforms to a real SVG element', () => {
    const namespace = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(namespace, 'svg');
    const circle = document.createElementNS(namespace, 'circle');
    circle.setAttribute('cx', '20');
    circle.setAttribute('cy', '20');
    circle.setAttribute('r', '10');
    svg.append(circle);
    document.body.append(svg);
    gsap.set(circle, { x: 0, rotation: 0, transformOrigin: 'center' });

    const tween = createMotionSpringTween(circle, {
      x: '60px',
      rotation: '45deg',
      from: { x: '0px', rotation: '0deg' },
      parameters,
      tween: { paused: true },
    });

    tween.time(tween.duration(), true);

    expect(numericProperty(circle, 'x')).toBeCloseTo(60, 6);
    expect(numericProperty(circle, 'rotation')).toBeCloseTo(45, 6);
    expect(circle.getAttribute('transform') ?? circle.style.transform).not.toBe(
      '',
    );

    tween.kill();
  });

  it('reverts an effect context and freezes a killed effect tween', () => {
    const target = createElement({ x: 25, rotation: 10 });
    let contextualTween: gsap.core.Tween | undefined;
    const context = gsap.context(() => {
      contextualTween = createMotionSpringTween(target, {
        x: '160px',
        rotation: '75deg',
        from: { x: '25px', rotation: '10deg' },
        parameters,
        tween: { paused: true },
      });
    });

    contextualTween!.time(0.2, true);
    expect(numericProperty(target, 'x')).not.toBeCloseTo(25, 6);
    context.revert();
    expect(numericProperty(target, 'x')).toBeCloseTo(25, 6);
    expect(numericProperty(target, 'rotation')).toBeCloseTo(10, 6);

    const killedTween = createMotionSpringTween(target, {
      x: '200px',
      from: { x: '25px' },
      parameters,
      tween: { paused: true },
    });
    killedTween.time(0.18, true);
    const atKill = numericProperty(target, 'x');
    killedTween.kill();
    killedTween.time(killedTween.duration(), true);

    expect(numericProperty(target, 'x')).toBeCloseTo(atKill, 8);
  });

  it('keeps a zero-distance reduced-motion fallback stable', () => {
    const target = createElement({ x: 25, opacity: 0.6 });
    const tween = createMotionSpringTween(target, {
      x: '25px',
      values: { opacity: 0.6 },
      from: { x: '25px', opacity: 0.6 },
      parameters,
      tween: { paused: true },
    });

    expect(tween.duration()).toBe(0);
    tween.totalProgress(1, true);
    expect(numericProperty(target, 'x')).toBeCloseTo(25, 8);
    expect(numericProperty(target, 'opacity')).toBeCloseTo(0.6, 8);

    tween.kill();
  });
});
