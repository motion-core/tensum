import type { SpringParameters, SpringRegime } from './types.js';

export const CRITICAL_DAMPING_TOLERANCE = 1e-7;

export function angularFrequency({ mass, stiffness }: SpringParameters): number {
  return Math.sqrt(stiffness) / Math.sqrt(mass);
}

export function dampingDecayRate({ mass, damping }: SpringParameters): number {
  if (damping === 0) return 0;

  // Divide the larger operand first so a representable c / (2m) is not lost
  // to either an overflowing ratio or an underflowing c / 2 intermediate.
  return damping > mass ? damping / 2 / mass : damping / mass / 2;
}

export function dampingRatio(parameters: SpringParameters): number {
  return dampingDecayRate(parameters) / angularFrequency(parameters);
}

export function classifyDamping(
  ratio: number,
  tolerance: number = CRITICAL_DAMPING_TOLERANCE,
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
