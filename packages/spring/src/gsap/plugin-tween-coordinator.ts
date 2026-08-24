export interface PluginTweenTiming {
  finiteDuration: number;
  infinite: boolean;
}

export interface PluginTweenParticipant {
  timing(): PluginTweenTiming;
  dispose(): void;
}

export interface PluginTweenRegistration {
  recompute(): void;
  remove(): void;
}

export interface PluginTweenState {
  tween: gsap.core.Tween;
  baseDuration: number;
  baseRepeat: number;
  participants: Set<PluginTweenParticipant>;
  generationTargets: Set<object>;
}

const states = new WeakMap<gsap.core.Tween, PluginTweenState>();
const GSAP_TIME_PRECISION = 1e7;

export function gsapSafeDuration(duration: number): number {
  return Math.ceil(duration * GSAP_TIME_PRECISION) / GSAP_TIME_PRECISION;
}

function applyTiming(state: PluginTweenState): void {
  let finiteDuration = 0;
  let infinite = false;
  for (const participant of state.participants) {
    const timing = participant.timing();
    finiteDuration = Math.max(finiteDuration, timing.finiteDuration);
    infinite ||= timing.infinite;
  }

  if (infinite) {
    state.tween.duration(1);
    state.tween.repeat(-1);
    return;
  }

  state.tween.repeat(state.baseRepeat);
  state.tween.duration(
    gsapSafeDuration(
      state.participants.size === 0 ? state.baseDuration : finiteDuration,
    ),
  );
}

function disposeParticipants(state: PluginTweenState): void {
  for (const participant of state.participants) participant.dispose();
  state.participants.clear();
}

/**
 * Starts one GSAP plugin init generation. Seeing the same target again marks a
 * fresh generation after `invalidate()`, including stagger children whose
 * source-array index isn't zero.
 */
export function beginPluginTweenInit(
  tween: gsap.core.Tween,
  target: object,
  options: { baseDuration: number; baseRepeat: number },
): PluginTweenState {
  let state = states.get(tween);
  if (!state) {
    state = {
      tween,
      baseDuration: options.baseDuration,
      baseRepeat: options.baseRepeat,
      participants: new Set(),
      generationTargets: new Set([target]),
    };
    states.set(tween, state);

    const previousInterrupt = tween.eventCallback('onInterrupt');
    tween.eventCallback('onInterrupt', () => {
      disposeParticipants(state!);
      previousInterrupt?.apply(
        tween.vars.callbackScope ?? tween,
        tween.vars.onInterruptParams ?? [],
      );
    });
  } else if (state.generationTargets.has(target)) {
    disposeParticipants(state);
    applyTiming(state);
    state.generationTargets.clear();
  }
  state.generationTargets.add(target);

  return state;
}

export function registerPluginTweenParticipant(
  state: PluginTweenState,
  participant: PluginTweenParticipant,
): PluginTweenRegistration {
  state.participants.add(participant);
  applyTiming(state);
  let active = true;

  return {
    recompute(): void {
      if (active) applyTiming(state);
    },
    remove(): void {
      if (!active) return;
      active = false;
      state.participants.delete(participant);
      applyTiming(state);
    },
  };
}
