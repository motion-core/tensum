import { describe, expect, it } from 'vitest';
import {
	DEFAULT_PARAMETERS,
	getDampingPresets,
	getDistanceResults,
	sampleTrajectory
} from './model.js';

describe('lab model', () => {
	it('shows distance-sensitive computed durations', () => {
		const results = getDistanceResults({ ...DEFAULT_PARAMETERS });
		const byDistance = new Map(results.map((result) => [result.distance, result.duration]));

		expect(byDistance.get(100)).toBeGreaterThan(byDistance.get(10)!);
		expect(byDistance.get(1000)).toBeGreaterThan(byDistance.get(100)!);
	});

	it('derives physical damping presets from mass and stiffness', () => {
		const presets = getDampingPresets({ ...DEFAULT_PARAMETERS });
		const critical = 2 * Math.sqrt(DEFAULT_PARAMETERS.mass * DEFAULT_PARAMETERS.stiffness);

		expect(presets.find((preset) => preset.regime === 'critical')?.damping).toBeCloseTo(critical);
		expect(presets.at(0)!.damping).toBeLessThan(critical);
		expect(presets.at(-1)!.damping).toBeGreaterThan(critical);
	});

	it('samples position and velocity from the analytical core', () => {
		const samples = sampleTrajectory({ ...DEFAULT_PARAMETERS }, 20);

		expect(samples).toHaveLength(21);
		expect(samples[0]).toMatchObject({ time: 0, position: 0, velocity: 0 });
		expect(samples.at(-1)!.position).toBeCloseTo(DEFAULT_PARAMETERS.target, 1);
	});
});
