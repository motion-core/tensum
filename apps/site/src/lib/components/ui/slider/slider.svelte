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
		min = 0,
		max = 100,
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
<span
	class={cn(
		isMeter
			? 'group/slider relative flex h-9 w-full cursor-pointer touch-none items-center rounded-md bg-muted p-0.5 text-sm transition-colors select-none data-disabled:cursor-not-allowed data-disabled:opacity-50'
			: 'contents',
		isMeter && className
	)}
>
	<SliderPrimitive.Root
		bind:ref
		bind:value={value as never}
		data-slot="slider"
		data-variant={isMeter ? 'meter' : 'default'}
		{orientation}
		{min}
		{max}
		aria-label={accessibleLabel}
		aria-labelledby={ariaLabelledby}
		aria-describedby={ariaDescribedby}
		class={cn(
			isMeter
				? 'absolute inset-y-0.5 inset-s-5 inset-e-0.5 flex touch-none items-center select-none data-disabled:cursor-not-allowed data-disabled:opacity-50'
				: 'relative flex w-full touch-none items-center select-none data-disabled:opacity-50 data-vertical:h-full data-vertical:min-h-40 data-vertical:w-auto data-vertical:flex-col',
			!isMeter && className
		)}
		{...restProps}
	>
		{#snippet children({ thumbItems })}
			<span
				data-slot="slider-track"
				data-orientation={orientation}
				class={cn(
					isMeter
						? 'relative h-full w-full overflow-visible rounded-sm'
						: 'relative grow overflow-hidden rounded-full bg-muted data-horizontal:h-1.5 data-horizontal:w-full data-vertical:h-full data-vertical:w-1.5'
				)}
			>
				<SliderPrimitive.Range
					data-slot="slider-range"
					class={cn(
						'absolute select-none data-horizontal:h-full data-vertical:w-full',
						isMeter ? 'meter-slider-range z-10' : 'bg-primary'
					)}
				/>
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
							? 'z-30 -ms-2 block h-5 w-1 shrink-0 rounded-full bg-muted-foreground shadow-sm ring-ring/50 transition-[background-color,box-shadow] select-none group-hover/slider:bg-foreground/70 after:absolute after:-inset-x-4 after:-inset-y-1 focus-visible:bg-foreground focus-visible:ring-3 focus-visible:outline-hidden active:bg-foreground disabled:pointer-events-none disabled:opacity-50'
							: 'block size-4 shrink-0 rounded-full border border-primary bg-white shadow-sm ring-ring/50 transition-[color,box-shadow] select-none hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50'
					)}
				/>
			{/each}
		{/snippet}
	</SliderPrimitive.Root>

	{#if isMeter}
		<span
			class="pointer-events-none absolute inset-y-0 inset-s-0 z-20 flex max-w-1/2 items-center ps-3 pe-3 font-medium"
			aria-hidden="true"
		>
			<span class="truncate">{label}</span>
		</span>
		<span
			class="pointer-events-none absolute inset-y-0 inset-e-0 z-20 flex items-center px-3 font-mono text-sm font-medium tabular-nums"
			aria-hidden="true"
		>
			{displayValue}
		</span>
	{/if}
</span>

<style>
	:global(.meter-slider-range)::before {
		position: absolute;
		inset-block: 0;
		inset-inline-start: -1.125rem;
		width: calc(100% + 1.125rem);
		border-radius: var(--radius-sm);
		background: var(--background);
		box-shadow:
			0 0 0 1px rgb(0 0 0 / 0.04),
			0 1px 1px rgb(0 0 0 / 0.05),
			0 2px 2px rgb(0 0 0 / 0.05),
			0 2px 4px rgb(0 0 0 / 0.05);
		content: '';
		pointer-events: none;
	}

	:global(.dark .meter-slider-range)::before {
		background: color-mix(in oklab, var(--card) 64%, transparent);
		box-shadow:
			inset 0 1px rgb(255 255 255 / 0.15),
			0 0 0 1px rgb(0 0 0 / 0.04),
			0 1px 1px rgb(0 0 0 / 0.05),
			0 2px 2px rgb(0 0 0 / 0.05),
			0 2px 4px rgb(0 0 0 / 0.05);
	}
</style>
