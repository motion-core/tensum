<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import type { TrajectorySample } from './model.js';

	let {
		samples,
		target
	}: {
		samples: TrajectorySample[];
		target: number;
	} = $props();

	const width = 760;
	const height = 180;
	const inset = 12;

	function pointsFor(key: 'position' | 'velocity'): string {
		if (samples.length === 0) return '';
		const values = samples.map((sample) => sample[key]);
		const min = Math.min(...values, key === 'position' ? target : 0);
		const max = Math.max(...values, key === 'position' ? target : 0);
		const span = Math.max(max - min, 1e-9);

		return samples
			.map((sample, index) => {
				const x = inset + (index / Math.max(samples.length - 1, 1)) * (width - inset * 2);
				const y = height - inset - ((sample[key] - min) / span) * (height - inset * 2);
				return `${x.toFixed(2)},${y.toFixed(2)}`;
			})
			.join(' ');
	}

	let positionPoints = $derived(pointsFor('position'));
	let velocityPoints = $derived(pointsFor('velocity'));
</script>

<Card.Root size="sm" class="h-full min-h-0">
	<Card.Header>
		<Card.Title>Analytical trajectory</Card.Title>
		<Card.Description>Position and velocity across the solver-computed duration.</Card.Description>
	</Card.Header>
	<Card.Content class="min-h-0 flex-1">
		<div class="grid h-full min-h-0 grid-cols-2 gap-3">
			<figure class="flex min-h-0 flex-col">
				<figcaption>Position</figcaption>
				<svg
					class="min-h-0 w-full flex-1"
					viewBox={`0 0 ${width} ${height}`}
					preserveAspectRatio="none"
					role="img"
					aria-label="Position over time graph"
				>
					<line
						x1={inset}
						x2={width - inset}
						y1={height - inset}
						y2={height - inset}
						class="stroke-border"
					/>
					<polyline
						points={positionPoints}
						fill="none"
						class="stroke-foreground"
						stroke-width="3"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
			</figure>
			<figure class="flex min-h-0 flex-col">
				<figcaption>Velocity</figcaption>
				<svg
					class="min-h-0 w-full flex-1"
					viewBox={`0 0 ${width} ${height}`}
					preserveAspectRatio="none"
					role="img"
					aria-label="Velocity over time graph"
				>
					<line
						x1={inset}
						x2={width - inset}
						y1={height / 2}
						y2={height / 2}
						class="stroke-border"
						stroke-dasharray="5 5"
					/>
					<polyline
						points={velocityPoints}
						fill="none"
						class="stroke-muted-foreground"
						stroke-width="3"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
			</figure>
		</div>
	</Card.Content>
</Card.Root>
