import type { SpringParameters, SpringRegime } from './types.js';

export const CRITICAL_DAMPING_TOLERANCE = 1e-7;

export function angularFrequency({ mass, stiffness }: SpringParameters): number {
  return Math.sqrt(stiffness / mass);
}

export function dampingRatio({ mass, stiffness, damping }: SpringParameters): number {
  return damping / (2 * Math.sqrt(stiffness * mass));
}

export function classifyDamping(
  ratio: number,
  tolerance = CRITICAL_DAMPING_TOLERANCE,
): SpringRegime {
  if (Math.abs(ratio - 1) <= tolerance) return 'critical';
  return ratio < 1 ? 'underdamped' : 'overdamped';
}

export function assertFinite(name: string, value: number): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${name} must be a finite number`);
  }
}

export function assertNonNegativeTime(time: number): void {
  assertFinite('time', time);
  if (time < 0) throw new RangeError('time must be greater than or equal to 0');
}
