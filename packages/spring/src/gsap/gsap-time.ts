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

function cycleAtTotalTime(
  animation: gsap.core.Tween,
  totalTime: number,
): LocalCycle {
  const duration = animation.duration();
  const playbackDirection = animation.reversed() ? -1 : 1;
  if (!(duration > 0)) return { time: 0, direction: playbackDirection };

  const repeat = animation.repeat();
  if (repeat === 0) {
    return {
      time: Math.min(totalTime, duration),
      direction: playbackDirection,
    };
  }

  const cycleDuration = duration + animation.repeatDelay();
  if (!(cycleDuration > 0)) return { time: 0, direction: playbackDirection };

  const finiteEnd = repeat >= 0 ? animation.totalDuration() : Infinity;
  const boundedTotalTime = Math.min(totalTime, finiteEnd);
  if (repeat >= 0 && boundedTotalTime >= finiteEnd) {
    const yoyoReversed = animation.yoyo() && repeat % 2 === 1;
    return {
      time: yoyoReversed ? 0 : duration,
      direction: (((yoyoReversed ? -1 : 1) * playbackDirection) as 1 | -1),
    };
  }

  const cycle = Math.floor(boundedTotalTime / cycleDuration);
  const yoyoReversed = animation.yoyo() && cycle % 2 === 1;
  const cycleTime = boundedTotalTime - cycle * cycleDuration;
  const forwardTime = Math.min(cycleTime, duration);
  return {
    time: yoyoReversed ? duration - forwardTime : forwardTime,
    direction:
      cycleTime > duration
        ? 0
        : (((yoyoReversed ? -1 : 1) * playbackDirection) as 1 | -1),
  };
}

export function currentLocalCycle(animation: gsap.core.Tween): LocalCycle {
  return cycleAtTotalTime(animation, animation.totalTime());
}

/** Maps a global instant to GSAP's cycle-local time, including repeat/yoyo. */
export function localCycleAt(
  animation: gsap.core.Tween,
  globalTime: number,
): LocalCycle {
  const totalTime = localTimeAt(animation, globalTime);
  return cycleAtTotalTime(animation, totalTime);
}
