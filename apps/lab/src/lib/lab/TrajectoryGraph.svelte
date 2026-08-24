<script lang="ts">
	import { curveMonotoneX, extent, scaleLinear } from 'd3';
	import { LineChart } from 'layerchart';
	import * as Card from '$lib/components/ui/card';
	import * as Chart from '$lib/components/ui/chart';
	import type { TrajectorySample } from './model.js';

	let {
		samples,
		target,
		positionUnit = 'px',
		velocityUnit = 'px/s',
		embedded = false
	}: {
		samples: TrajectorySample[];
		target: number;
		positionUnit?: string;
		velocityUnit?: string;
		embedded?: boolean;
	} = $props();

	type Metric = 'position' | 'velocity';

	const xScale = scaleLinear();
	const positionScale = scaleLinear();
	const velocityScale = scaleLinear();
	const axisNumber = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
	const tooltipNumber = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

	let chartConfig = $derived({
		position: { label: `Position (${positionUnit})`, color: 'var(--chart-1)' },
		velocity: { label: `Velocity (${velocityUnit})`, color: 'var(--chart-2)' }
	} satisfies Chart.ChartConfig);

	let positionSeries = $derived([
		{
			key: 'position',
			label: chartConfig.position.label,
			value: 'position',
			color: chartConfig.position.color
		}
	]);

	let velocitySeries = $derived([
		{
			key: 'velocity',
			label: chartConfig.velocity.label,
			value: 'velocity',
			color: chartConfig.velocity.color
		}
	]);

	let duration = $derived(samples.at(-1)?.time ?? 0);
	let positionDomain = $derived(domainFor('position'));
	let velocityDomain = $derived(domainFor('velocity'));
	let positionAnnotations = $derived([
		{
			type: 'line' as const,
			layer: 'below' as const,
			y: target,
			label: `target ${formatMeasurement(target, positionUnit)}`,
			labelPlacement: 'top-right' as const,
			labelXOffset: 4,
			labelYOffset: 3,
			props: {
				line: {
					stroke: 'var(--muted-foreground)',
					strokeWidth: 1,
					dashArray: '4 4',
					opacity: 0.7
				},
				label: { fill: 'var(--muted-foreground)' }
			}
		}
	]);

	function domainFor(metric: Metric): [number, number] {
		const values = samples.map((sample) => sample[metric]);
		values.push(metric === 'position' ? target : 0);
		const [minimum = 0, maximum = 1] = extent(values);

		if (minimum === maximum) {
			const padding = Math.max(Math.abs(minimum) * 0.1, 1);
			return [minimum - padding, maximum + padding];
		}

		return [minimum, maximum];
	}

	function formatAxis(value: unknown): string {
		return typeof value === 'number' ? axisNumber.format(value) : String(value);
	}

	function formatTime(value: unknown): string {
		return typeof value === 'number' ? `${tooltipNumber.format(value)} s` : String(value);
	}

	function formatMeasurement(value: number, unit: string): string {
		const separator = unit === '°' ? '' : ' ';
		return `${formatAxis(value)}${separator}${unit}`;
	}
</script>

{#snippet charts(isEmbedded: boolean)}
	<div
		class={isEmbedded
			? 'grid min-h-0 grid-cols-1 gap-6 p-3 sm:min-h-56 sm:grid-cols-2'
			: 'grid h-full min-h-0 grid-cols-1 gap-6 sm:grid-cols-2'}
	>
		<figure class="flex min-h-36 flex-col sm:min-h-0" aria-labelledby="position-chart-title">
			<figcaption class="flex items-center justify-between gap-2 text-sm" id="position-chart-title">
				<span class="font-medium">Position</span>
				<span class="flex items-center gap-1.5 text-muted-foreground">
					<span class="size-2 rounded-full bg-chart-1" aria-hidden="true"></span>
					{positionUnit}
				</span>
			</figcaption>

			<Chart.Container
				config={chartConfig}
				class="aspect-auto min-h-0 w-full flex-1"
				role="img"
				aria-label={`Position in ${positionUnit} over time in seconds. Dashed line marks the target position.`}
				tabindex={0}
			>
				<LineChart
					data={samples}
					x="time"
					{xScale}
					xDomain={[0, duration]}
					yScale={positionScale}
					yDomain={positionDomain}
					yNice
					yPadding={[6, 6]}
					axis
					grid={{ y: { stroke: 'var(--border)', opacity: 0.7 } }}
					rule={false}
					series={positionSeries}
					annotations={positionAnnotations}
					padding={{ top: 10, right: 12, bottom: 30, left: 46 }}
					props={{
						spline: { curve: curveMonotoneX, strokeWidth: 2 },
						xAxis: {
							label: 'Time (s)',
							labelPlacement: 'end',
							format: formatAxis,
							tickSpacing: 72
						},
						yAxis: {
							label: `Position (${positionUnit})`,
							format: formatAxis,
							tickSpacing: 32
						},
						highlight: {
							lines: { stroke: 'var(--muted-foreground)', strokeWidth: 1 },
							points: { r: 3, stroke: 'var(--card)', strokeWidth: 2 }
						}
					}}
				>
					{#snippet tooltip()}
						<Chart.Tooltip indicator="line" labelFormatter={formatTime} />
					{/snippet}
				</LineChart>
			</Chart.Container>
		</figure>

		<figure class="flex min-h-36 flex-col sm:min-h-0" aria-labelledby="velocity-chart-title">
			<figcaption class="flex items-center justify-between gap-2 text-sm" id="velocity-chart-title">
				<span class="font-medium">Velocity</span>
				<span class="flex items-center gap-1.5 text-muted-foreground">
					<span class="size-2 rounded-full bg-chart-2" aria-hidden="true"></span>
					{velocityUnit}
				</span>
			</figcaption>

			<Chart.Container
				config={chartConfig}
				class="aspect-auto min-h-0 w-full flex-1"
				role="img"
				aria-label={`Velocity in ${velocityUnit} over time in seconds. Dashed line marks zero velocity.`}
				tabindex={0}
			>
				<LineChart
					data={samples}
					x="time"
					{xScale}
					xDomain={[0, duration]}
					yScale={velocityScale}
					yDomain={velocityDomain}
					yNice
					yPadding={[6, 6]}
					axis
					grid={{ y: { stroke: 'var(--border)', opacity: 0.7 } }}
					rule={{ stroke: 'var(--muted-foreground)', dashArray: '4 4', opacity: 0.7 }}
					series={velocitySeries}
					padding={{ top: 10, right: 12, bottom: 30, left: 52 }}
					props={{
						spline: { curve: curveMonotoneX, strokeWidth: 2 },
						xAxis: {
							label: 'Time (s)',
							labelPlacement: 'end',
							format: formatAxis,
							tickSpacing: 72
						},
						yAxis: {
							label: `Velocity (${velocityUnit})`,
							format: formatAxis,
							tickSpacing: 32
						},
						highlight: {
							lines: { stroke: 'var(--muted-foreground)', strokeWidth: 1 },
							points: { r: 3, stroke: 'var(--card)', strokeWidth: 2 }
						}
					}}
				>
					{#snippet tooltip()}
						<Chart.Tooltip indicator="line" labelFormatter={formatTime} />
					{/snippet}
				</LineChart>
			</Chart.Container>
		</figure>
	</div>
{/snippet}

{#if embedded}
	<section class="flex min-h-0 flex-col" aria-labelledby="trajectory-heading">
		<header class="flex h-10 items-center border-b border-border px-3">
			<h2 class="font-heading text-sm font-medium" id="trajectory-heading">
				Analytical trajectory
			</h2>
		</header>
		{@render charts(true)}
	</section>
{:else}
	<Card.Root size="sm" class="h-full min-h-0">
		<Card.Header>
			<Card.Title>Analytical trajectory</Card.Title>
		</Card.Header>
		<Card.Content class="min-h-0 flex-1">
			{@render charts(false)}
		</Card.Content>
	</Card.Root>
{/if}
