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
  if (animation.paused()) return animation.totalTime();
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

export interface LocalCycle {
  time: number;
  direction: 1 | 0 | -1;
}

/** Maps a global instant to GSAP's cycle-local time, including repeat/yoyo. */
export function localCycleAt(
  animation: gsap.core.Tween,
  globalTime: number,
): LocalCycle {
  const duration = animation.duration();
  if (!(duration > 0)) return { time: 0, direction: 1 };

  const totalTime = localTimeAt(animation, globalTime);
  const repeat = animation.repeat();
  if (repeat === 0) {
    return { time: Math.min(totalTime, duration), direction: 1 };
  }

  const cycleDuration = duration + animation.repeatDelay();
  if (!(cycleDuration > 0)) return { time: 0, direction: 1 };

  const finiteEnd = repeat >= 0 ? animation.totalDuration() : Infinity;
  const boundedTotalTime = Math.min(totalTime, finiteEnd);
  if (repeat >= 0 && boundedTotalTime >= finiteEnd) {
    const reversed = animation.yoyo() && repeat % 2 === 1;
    return { time: reversed ? 0 : duration, direction: 0 };
  }

  const cycle = Math.floor(boundedTotalTime / cycleDuration);
  const reversed = animation.yoyo() && cycle % 2 === 1;
  const forwardTime = Math.min(
    boundedTotalTime - cycle * cycleDuration,
    duration,
  );
  return {
    time: reversed ? duration - forwardTime : forwardTime,
    direction:
      boundedTotalTime - cycle * cycleDuration > duration
        ? 0
        : reversed
          ? -1
          : 1,
  };
}
