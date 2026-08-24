<script lang="ts">
	import { Slider as SliderPrimitive } from 'bits-ui';
	import { cn, type WithoutChildrenOrChild } from '$lib/utils.js';

	type SliderProps = WithoutChildrenOrChild<SliderPrimitive.RootProps> & {
		label?: string;
		displayValue?: string;
	};

	let {
		ref = $bindable(null),
		value = $bindable(),
		orientation = 'horizontal',
		label,
		displayValue,
		class: className,
		'aria-label': ariaLabel,
		'aria-labelledby': ariaLabelledby,
		'aria-describedby': ariaDescribedby,
		...restProps
	}: SliderProps = $props();

	let isMeter = $derived(
		orientation === 'horizontal' && label !== undefined && displayValue !== undefined
	);
	let accessibleLabel = $derived(ariaLabel ?? label);
</script>

<!--
Discriminated Unions + Destructing (required for bindable) do not
get along, so we shut typescript up by casting `value` to `never`.
-->
<SliderPrimitive.Root
	bind:ref
	bind:value={value as never}
	data-slot="slider"
	data-variant={isMeter ? 'meter' : 'default'}
	{orientation}
	aria-label={accessibleLabel}
	aria-labelledby={ariaLabelledby}
	aria-describedby={ariaDescribedby}
	class={cn(
		isMeter
			? 'group/slider relative flex h-7 w-full cursor-pointer touch-none items-center rounded-md border border-border/70 text-xs shadow-xs transition-colors select-none hover:bg-muted/30 data-disabled:cursor-not-allowed data-disabled:opacity-50'
			: 'relative flex w-full touch-none items-center select-none data-disabled:opacity-50 data-vertical:h-full data-vertical:min-h-40 data-vertical:w-auto data-vertical:flex-col',
		className
	)}
	{...restProps}
>
	{#snippet children({ thumbItems })}
		<span
			data-slot="slider-track"
			data-orientation={orientation}
			class={cn(
				isMeter
					? 'relative h-full w-full grow overflow-hidden rounded-[calc(var(--radius)*0.6)]'
					: 'relative grow overflow-hidden rounded-md bg-muted data-horizontal:h-1 data-horizontal:w-full data-vertical:h-full data-vertical:w-1'
			)}
		>
			<SliderPrimitive.Range
				data-slot="slider-range"
				class={cn(
					'absolute select-none data-horizontal:h-full data-vertical:w-full',
					isMeter ? 'z-10 bg-muted' : 'bg-primary'
				)}
			/>
			{#if isMeter}
				<span
					class="pointer-events-none absolute inset-y-0 start-0 z-20 flex max-w-[48%] items-center px-2 font-medium"
					aria-hidden="true"
				>
					<span class="truncate">{label}</span>
				</span>
				<span
					class="pointer-events-none absolute inset-y-0 end-0 z-20 flex items-center px-2 font-mono text-[0.6875rem] font-medium tabular-nums"
					aria-hidden="true"
				>
					{displayValue}
				</span>
			{/if}
		</span>
		{#each thumbItems as thumb (thumb.index)}
			<SliderPrimitive.Thumb
				data-slot="slider-thumb"
				index={thumb.index}
				aria-label={accessibleLabel}
				aria-labelledby={ariaLabelledby}
				aria-describedby={ariaDescribedby}
				aria-valuetext={isMeter ? displayValue : undefined}
				class={cn(
					isMeter
						? 'z-30 block h-4.5 w-1 shrink-0 rounded-full bg-muted-foreground shadow-sm ring-ring/40 select-none group-hover/slider:bg-foreground/60 after:absolute after:-inset-x-2 after:-inset-y-1 focus-visible:bg-foreground focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-hidden active:bg-foreground disabled:pointer-events-none disabled:opacity-50'
						: 'relative block size-3 shrink-0 rounded-md border border-ring bg-background ring-ring/30 transition-[color,box-shadow] select-none after:absolute after:-inset-2 hover:ring-2 focus-visible:ring-2 focus-visible:outline-hidden active:ring-2 disabled:pointer-events-none disabled:opacity-50'
				)}
			/>
		{/each}
	{/snippet}
</SliderPrimitive.Root>
