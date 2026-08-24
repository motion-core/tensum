interface GlobalTimeAnimation {
  globalTime(rawTime?: number): number;
}

function withGlobalTime(animation: gsap.core.Tween): GlobalTimeAnimation {
  return animation as gsap.core.Tween & GlobalTimeAnimation;
}

export function globalTimeAt(
  animation: gsap.core.Tween,
  localTime: number,
): number {
  return withGlobalTime(animation).globalTime(localTime);
}

export function localTimeAt(
  animation: gsap.core.Tween,
  globalTime: number,
): number {
  if (animation.paused()) return animation.time();
  const globalStart = globalTimeAt(animation, 0);
  const globalNextSecond = globalTimeAt(animation, 1);
  const globalSecondsPerLocalSecond = globalNextSecond - globalStart;
  if (
    !Number.isFinite(globalSecondsPerLocalSecond) ||
    globalSecondsPerLocalSecond === 0
  ) {
    return animation.time();
  }
  return Math.max(0, (globalTime - globalStart) / globalSecondsPerLocalSecond);
}
