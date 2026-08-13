<script lang="ts">
	import type { SpringSolution } from '@real-spring/spring-core';
	import { Badge } from '$lib/components/ui/badge';
	import * as Card from '$lib/components/ui/card';
	import type { LabTelemetry } from './model.js';
	import { formatNumber } from './model.js';

	let {
		spring,
		telemetry
	}: {
		spring: SpringSolution;
		telemetry: LabTelemetry;
	} = $props();

	let values = $derived([
		{
			label: 'Distance',
			value: `${formatNumber(Math.abs(spring.initialState.target - spring.initialState.position), 0)} px`
		},
		{ label: 'Damping ratio', value: formatNumber(spring.dampingRatio, 3) },
		{ label: 'Settling duration', value: `${formatNumber(spring.getSettlingDuration(), 3)} s` },
		{ label: 'Position', value: `${formatNumber(telemetry.position, 2)} px` },
		{ label: 'Velocity', value: `${formatNumber(telemetry.velocity, 2)} px/s` },
		{ label: 'Elapsed', value: `${formatNumber(telemetry.elapsed, 3)} s` }
	]);
</script>

<Card.Root size="sm">
	<Card.Header>
		<Card.Title>Live telemetry</Card.Title>
		<Card.Action>
			<div class="flex items-center gap-1">
				<Badge variant="secondary">{spring.regime}</Badge>
				<Badge variant="outline">ζ {formatNumber(spring.dampingRatio, 3)}</Badge>
			</div>
		</Card.Action>
	</Card.Header>
	<Card.Content>
		<dl class="grid grid-cols-3 gap-x-3 gap-y-2 lg:grid-cols-6">
			{#each values as item (item.label)}
				<div class="min-w-0">
					<dt class="truncate text-muted-foreground">{item.label}</dt>
					<dd class="truncate font-semibold tabular-nums" title={item.value}>{item.value}</dd>
				</div>
			{/each}
		</dl>
	</Card.Content>
</Card.Root>
