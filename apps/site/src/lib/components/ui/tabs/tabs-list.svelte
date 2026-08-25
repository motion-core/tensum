<script lang="ts" module>
	import { tv, type VariantProps } from 'tailwind-variants';

	export const tabsListVariants = tv({
		base: 'group/tabs-list inline-flex w-fit items-center justify-center rounded-md p-0.5 text-muted-foreground/70 group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col data-[variant=line]:rounded-none',
		variants: {
			variant: {
				default: 'cn-tabs-list-variant-default bg-muted',
				line: 'cn-tabs-list-variant-line gap-1 bg-transparent'
			}
		},
		defaultVariants: {
			variant: 'default'
		}
	});

	export type TabsListVariant = VariantProps<typeof tabsListVariants>['variant'];
</script>

<script lang="ts">
	import { Tabs as TabsPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils.js';

	let {
		ref = $bindable(null),
		variant = 'default',
		indicatorIndex,
		indicatorCount,
		style,
		class: className,
		...restProps
	}: TabsPrimitive.ListProps & {
		variant?: TabsListVariant;
		indicatorIndex?: number;
		indicatorCount?: number;
	} = $props();

	let hasIndicator = $derived(
		variant === 'default' && indicatorIndex !== undefined && indicatorCount !== undefined
	);
	let normalizedIndex = $derived(Math.max(indicatorIndex ?? 0, 0));
	let normalizedCount = $derived(Math.max(indicatorCount ?? 1, 1));
</script>

<TabsPrimitive.List
	bind:ref
	data-slot="tabs-list"
	data-variant={variant}
	data-has-selection={hasIndicator && (indicatorIndex ?? -1) >= 0}
	class={cn(tabsListVariants({ variant }), hasIndicator && 'selection-indicator', className)}
	style={`${style ?? ''}; --selection-index: ${normalizedIndex}; --selection-count: ${normalizedCount};`}
	{...restProps}
/>

<style>
	:global(.cn-tabs-list-variant-default.selection-indicator)::before {
		inset-block: 0.125rem;
		inset-inline-start: 0.125rem;
		inline-size: calc((100% - 0.25rem) / var(--selection-count));
		block-size: calc(100% - 0.25rem);
		translate: calc(var(--selection-index) * 100%) 0;
	}

	:global(.cn-tabs-list-variant-default.selection-indicator[data-orientation='vertical'])::before {
		inline-size: calc(100% - 0.25rem);
		block-size: calc((100% - 0.25rem) / var(--selection-count));
		translate: 0 calc(var(--selection-index) * 100%);
	}
</style>
