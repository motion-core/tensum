import { createSpring, springPresets } from '@motion-core/spring';
import type { SpringParameters, SpringSolution, SpringState } from '@motion-core/spring';

export type PlaygroundScenario = 'distance' | 'rotation' | 'timeline';

export interface TrajectorySample {
	time: number;
	position: number;
	velocity: number;
}

export interface TimelineMotion {
	far: number;
	near: number;
	firstParameters: Readonly<SpringParameters>;
	secondParameters: Readonly<SpringParameters>;
	first: SpringSolution;
	second: SpringSolution;
	firstEnd: number;
	secondEnd: number;
	duration: number;
}

export const TIMELINE_HANDOFF_TIME = 0.35;

const TRAJECTORY_SAMPLE_COUNT = 160;

export function createTimelineMotion(trackWidth: number): TimelineMotion {
	const available = Math.max(trackWidth - 96, 0);
	const far = available * 0.82;
	const near = available * 0.22;
	const firstParameters = springPresets.snappy();
	const secondParameters = springPresets.bouncy();
	const first = createSpring({ from: 0, to: far, ...firstParameters });
	const handoff = first.stateAt(TIMELINE_HANDOFF_TIME);
	const second = createSpring({
		from: handoff.position,
		to: near,
		velocity: handoff.velocity,
		...secondParameters
	});
	const firstEnd = first.getSettlingDuration();
	const secondEnd = TIMELINE_HANDOFF_TIME + second.getSettlingDuration();

	return {
		far,
		near,
		firstParameters,
		secondParameters,
		first,
		second,
		firstEnd,
		secondEnd,
		duration: Math.max(firstEnd, secondEnd)
	};
}

export function createTrajectory(
	scenario: PlaygroundScenario,
	parameters: Readonly<SpringParameters>,
	initialState: SpringState,
	distanceTarget: number,
	rotationTarget: number,
	timelineMotion: TimelineMotion
): { samples: TrajectorySample[]; target: number } {
	if (scenario === 'timeline') {
		return {
			target: timelineMotion.near,
			samples: sampleStates(timelineMotion.duration, (time) =>
				time < TIMELINE_HANDOFF_TIME
					? timelineMotion.first.stateAt(time)
					: timelineMotion.second.stateAt(time - TIMELINE_HANDOFF_TIME)
			)
		};
	}

	const target = scenario === 'rotation' ? rotationTarget : distanceTarget;
	const spring = createSpring({
		from: initialState.position,
		to: target,
		velocity: initialState.velocity,
		...parameters
	});

	return {
		target,
		samples: sampleStates(spring.getSettlingDuration(), (time) => spring.stateAt(time))
	};
}

function sampleStates(
	duration: number,
	stateAt: (time: number) => SpringState
): TrajectorySample[] {
	const displayDuration = Math.max(duration, 0.25);

	return Array.from({ length: TRAJECTORY_SAMPLE_COUNT + 1 }, (_, index) => {
		const time = (displayDuration * index) / TRAJECTORY_SAMPLE_COUNT;
		return { time, ...stateAt(time) };
	});
}
