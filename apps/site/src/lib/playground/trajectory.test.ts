import { springPresets } from '@motion-core/spring';
import { describe, expect, it } from 'vitest';
import { createTimelineMotion, createTrajectory, TIMELINE_HANDOFF_TIME } from './trajectory.js';

describe('playground trajectories', () => {
	it('samples distance motion from the current state rather than a fixed origin', () => {
		const motion = createTimelineMotion(800);
		const trajectory = createTrajectory(
			'distance',
			springPresets.snappy(),
			{ position: 320, velocity: -80 },
			0,
			0,
			motion
		);

		expect(trajectory.samples).toHaveLength(161);
		expect(trajectory.samples[0]).toMatchObject({ time: 0, position: 320, velocity: -80 });
		expect(trajectory.samples.at(-1)?.position).toBeCloseTo(0, 1);
		expect(trajectory.samples.some((sample) => Math.abs(sample.velocity) > 1)).toBe(true);
	});

	it('preserves position and velocity at the timeline handoff', () => {
		const motion = createTimelineMotion(800);
		const outgoing = motion.first.stateAt(TIMELINE_HANDOFF_TIME);
		const incoming = motion.second.stateAt(0);

		expect(incoming.position).toBeCloseTo(outgoing.position, 10);
		expect(incoming.velocity).toBeCloseTo(outgoing.velocity, 10);
	});
});
