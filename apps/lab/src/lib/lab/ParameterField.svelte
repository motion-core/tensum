<script lang="ts">
	import { Slider } from '$lib/components/ui/slider';

	let {
		id,
		label,
		value,
		min,
		max,
		step,
		unit,
		description,
		onValue
	}: {
		id: string;
		label: string;
		value: number;
		min: number;
		max: number;
		step: number;
		unit: string;
		description: string;
		onValue: (value: number) => void;
	} = $props();

	let formattedValue = $derived(
		`${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value)} ${unit}`
	);
</script>

<div class="space-y-1">
	<div class="flex items-center justify-between gap-2">
		<label class="truncate font-medium" for={id} title={description}>{label}</label>
		<output class="shrink-0 text-muted-foreground tabular-nums" for={id}>{formattedValue}</output>
		<span class="sr-only" id={`${id}-description`}>{description}</span>
	</div>
	<Slider
		type="single"
		{id}
		{min}
		{max}
		{step}
		{value}
		aria-label={label}
		aria-describedby={`${id}-description`}
		onValueChange={onValue}
	/>
</div>
