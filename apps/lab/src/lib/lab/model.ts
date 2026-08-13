import { createSpring } from '@motion-core/spring';
import type { SpringRegime, SpringSolution } from '@motion-core/spring';

export interface LabParameters {
	target: number;
	mass: number;
	stiffness: number;
	damping: number;
	initialVelocity: number;
	positionEpsilon: number;
	velocityEpsilon: number;
}

export type LabParameterName = keyof LabParameters;
export type AnimationStatus = 'idle' | 'running' | 'settled' | 'reduced';

export interface LabTelemetry {
	elapsed: number;
	position: number;
	velocity: number;
	status: AnimationStatus;
}

export interface DistanceResult {
	distance: number;
	duration: number;
	settled: boolean;
}

export interface TrajectorySample {
	time: number;
	position: number;
	velocity: number;
}

export interface DampingPreset {
	label: string;
	description: string;
	damping: number;
	regime: SpringRegime;
}

export const DEFAULT_PARAMETERS: Readonly<LabParameters> = {
	target: 500,
	mass: 1,
	stiffness: 180,
	damping: 24,
	initialVelocity: 0,
	positionEpsilon: 0.1,
	velocityEpsilon: 0.1
};

export const DISTANCES = [10, 50, 100, 300, 600, 1000] as const;
export const VELOCITIES = [0, 500, 1500, -500] as const;

export function createLabSpring(
	parameters: LabParameters,
	to = parameters.target,
	velocity = parameters.initialVelocity,
	from = 0
): SpringSolution {
	return createSpring({
		from,
		to,
		velocity,
		mass: parameters.mass,
		stiffness: parameters.stiffness,
		damping: parameters.damping,
		settle: {
			position: parameters.positionEpsilon,
			velocity: parameters.velocityEpsilon
		}
	});
}

export function getDistanceResults(parameters: LabParameters): DistanceResult[] {
	return DISTANCES.map((distance) => {
		const result = createLabSpring(parameters, distance, 0).getSettlingResult();
		return { distance, duration: result.duration, settled: result.settled };
	});
}

export function getDampingPresets(parameters: LabParameters): DampingPreset[] {
	const critical = 2 * Math.sqrt(parameters.stiffness * parameters.mass);
	return [
		{
			label: 'Underdamped',
			description: 'Visible overshoot and oscillation',
			damping: critical * 0.35,
			regime: 'underdamped'
		},
		{
			label: 'Near-critical',
			description: 'Fast response with restrained overshoot',
			damping: critical * 0.9,
			regime: 'underdamped'
		},
		{
			label: 'Critical',
			description: 'Fastest non-oscillating response',
			damping: critical,
			regime: 'critical'
		},
		{
			label: 'Overdamped',
			description: 'Slower, monotonic convergence',
			damping: critical * 1.5,
			regime: 'overdamped'
		}
	];
}

export function sampleTrajectory(parameters: LabParameters, count = 160): TrajectorySample[] {
	const spring = createLabSpring(parameters);
	const duration = spring.getSettlingDuration();
	const displayDuration = Math.max(duration, 0.25);

	return Array.from({ length: count + 1 }, (_, index) => {
		const time = (displayDuration * index) / count;
		return { time, ...spring.stateAt(time) };
	});
}

export function formatNumber(value: number, digits = 2): string {
	if (!Number.isFinite(value)) return '—';
	return new Intl.NumberFormat('en-US', {
		maximumFractionDigits: digits,
		minimumFractionDigits: digits
	}).format(value);
}
