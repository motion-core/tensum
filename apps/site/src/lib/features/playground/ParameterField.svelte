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

	let formattedNumber = $derived(
		new Intl.NumberFormat('en-US', {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		}).format(value)
	);
	let formattedValue = $derived(unit ? `${formattedNumber} ${unit}` : formattedNumber);
</script>

<div>
	<span class="sr-only" id={`${id}-description`}>{description}</span>
	<Slider
		type="single"
		{id}
		{label}
		displayValue={formattedValue}
		{min}
		{max}
		{step}
		{value}
		aria-describedby={`${id}-description`}
		title={description}
		onValueChange={onValue}
	/>
</div>
