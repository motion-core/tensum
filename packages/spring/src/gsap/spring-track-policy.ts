import type { SettlingResult, SpringSolution, SpringState } from '../types.js';

export const UNSETTLED_POLICIES = [
  'continue',
  'stop',
  'snap',
  'error',
] as const;
export type UnsettledPolicy = (typeof UNSETTLED_POLICIES)[number];

export interface SpringTrackSampleSource {
  readonly duration: number;
  readonly settling: SettlingResult;
  readonly spring: SpringSolution;
  readonly target: number;
}

export interface SpringTrackTiming {
  readonly driverDuration: number;
  readonly finiteDuration: number;
  readonly hasUnsettled: boolean;
  readonly logicalDuration: number;
  readonly requestedLogicalDuration: number;
  readonly unsettledAt: number;
}

const GSAP_TIME_PRECISION = 1e7;

export function validateUnsettledPolicy(
  value: unknown,
  context = 'unsettled',
): UnsettledPolicy {
  if (
    value !== 'continue' &&
    value !== 'stop' &&
    value !== 'snap' &&
    value !== 'error'
  ) {
    throw new TypeError(
      `${context} must be one of: ${UNSETTLED_POLICIES.join(', ')}`,
    );
  }
  return value;
}

export function gsapSafeDuration(duration: number): number {
  if (!Number.isFinite(duration) || duration < 0) {
    throw new RangeError(
      'GSAP duration must be a finite number greater than or equal to 0',
    );
  }
  return Math.ceil(duration * GSAP_TIME_PRECISION) / GSAP_TIME_PRECISION;
}

export function gsapDriverTime(
  elapsed: number,
  finiteDuration: number,
  driverDuration: number = gsapSafeDuration(finiteDuration),
): number {
  if (!Number.isFinite(elapsed) || elapsed < 0) {
    throw new RangeError(
      'elapsed time must be a finite number greater than or equal to 0',
    );
  }
  if (finiteDuration === 0 || elapsed >= finiteDuration) return driverDuration;
  return (elapsed / finiteDuration) * driverDuration;
}

export function springElapsedTime(
  driverTime: number,
  finiteDuration: number,
  driverDuration: number = gsapSafeDuration(finiteDuration),
): number {
  if (!Number.isFinite(driverTime) || driverTime < 0) {
    throw new RangeError(
      'driver time must be a finite number greater than or equal to 0',
    );
  }
  if (finiteDuration === 0 || driverDuration === 0) return 0;
  if (driverTime >= driverDuration) return finiteDuration;
  return (driverTime / driverDuration) * finiteDuration;
}

export function springTrackState(
  track: SpringTrackSampleSource,
  time: number,
  policy: UnsettledPolicy,
): SpringState {
  if (track.settling.settled && time >= track.duration) {
    return { position: track.target, velocity: 0 };
  }
  if (!track.settling.settled && time >= track.duration) {
    if (policy === 'snap') return { position: track.target, velocity: 0 };
    if (policy === 'continue') return track.spring.stateAt(time);
    return track.spring.stateAt(track.duration);
  }
  return track.spring.stateAt(time);
}

export function springTrackTiming(
  tracks: readonly SpringTrackSampleSource[],
  policy: UnsettledPolicy,
): SpringTrackTiming {
  const finiteDuration = Math.max(...tracks.map((track) => track.duration), 0);
  const hasUnsettled = tracks.some((track) => !track.settling.settled);
  const requestedLogicalDuration = Math.max(
    ...tracks.map((track) => track.spring.timing.perceptualDuration),
    0,
  );
  const logicalDuration =
    policy === 'continue' && hasUnsettled
      ? requestedLogicalDuration
      : Math.min(requestedLogicalDuration, finiteDuration);

  return {
    driverDuration: gsapSafeDuration(finiteDuration),
    finiteDuration,
    hasUnsettled,
    logicalDuration,
    requestedLogicalDuration,
    unsettledAt: Math.max(
      ...tracks
        .filter((track) => !track.settling.settled)
        .map((track) => track.duration),
      0,
    ),
  };
}
