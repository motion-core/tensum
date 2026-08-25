import type { ActiveTrackRegistration } from './active-tracks.js';

export interface ActiveTrackTransition {
  readonly isOwner: boolean;
  readonly releasedAtStart: boolean;
  readonly restoredPrevious: boolean;
}

/**
 * Keeps registry membership aligned with GSAP playback without allowing a
 * discarded forward-running track to reclaim ownership. Earlier registrations
 * may reactivate only when their local clock moves backwards.
 */
export function syncActiveTrackRegistration(
  registration: ActiveTrackRegistration,
  time: number,
  lastTime: number,
  options: { retainAtStart?: boolean } = {},
): ActiveTrackTransition {
  if (
    !options.retainAtStart &&
    time <= 0 &&
    lastTime > 0 &&
    registration.isActive()
  ) {
    const restored = registration.release();
    return {
      isOwner: false,
      releasedAtStart: true,
      restoredPrevious: restored,
    };
  }

  if (
    time > 0 &&
    !registration.isActive() &&
    (lastTime <= 0 || time < lastTime)
  ) {
    registration.activate();
  }

  return {
    isOwner: registration.isOwner(),
    releasedAtStart: false,
    restoredPrevious: false,
  };
}

export function retireActiveTrackRegistrations(
  registrations: Iterable<ActiveTrackRegistration | undefined>,
): void {
  for (const registration of registrations) registration?.retire();
}
