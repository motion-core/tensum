<script lang="ts">
	import { Input } from '$lib/components/ui/input';
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

	function updateFromInput(event: Event): void {
		const next = (event.currentTarget as HTMLInputElement).valueAsNumber;
		if (Number.isFinite(next) && next >= min && next <= max) onValue(next);
	}
</script>

<div class="space-y-1">
	<div class="grid grid-cols-[minmax(0,1fr)_5rem_3rem] items-center gap-2">
		<label class="truncate font-medium" for={id} title={description}>{label}</label>
		<Input
			class="tabular-nums"
			{id}
			type="number"
			{min}
			{max}
			{step}
			{value}
			aria-describedby={`${id}-description`}
			oninput={updateFromInput}
		/>
		<span class="truncate text-muted-foreground" title={unit}>{unit}</span>
		<span class="sr-only" id={`${id}-description`}>{description}</span>
	</div>
	<Slider type="single" {min} {max} {step} {value} aria-label={label} onValueChange={onValue} />
</div>
