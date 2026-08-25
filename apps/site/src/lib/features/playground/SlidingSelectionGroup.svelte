<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils';

	type Props = HTMLAttributes<HTMLDivElement> & {
		selectedIndex: number;
		count: number;
		children: Snippet;
	};

	let { selectedIndex, count, class: className, children, ...restProps }: Props = $props();

	let normalizedIndex = $derived(Math.max(selectedIndex, 0));
	let normalizedCount = $derived(Math.max(count, 1));
</script>

<div
	data-slot="sliding-selection-group"
	data-has-selection={selectedIndex >= 0}
	class={cn(
		'selection-indicator sliding-selection-group grid rounded-md bg-muted p-0.5 text-muted-foreground/70',
		className
	)}
	style:--selection-index={normalizedIndex}
	style:--selection-count={normalizedCount}
	{...restProps}
>
	{@render children()}
</div>

<style>
	.sliding-selection-group {
		grid-template-columns: repeat(var(--selection-count), minmax(0, 1fr));
	}

	.sliding-selection-group::before {
		inset-block: 0.125rem;
		inset-inline-start: 0.125rem;
		inline-size: calc((100% - 0.25rem) / var(--selection-count));
		block-size: calc(100% - 0.25rem);
		translate: calc(var(--selection-index) * 100%) 0;
	}

	@media (min-width: 64rem) {
		.sliding-selection-group {
			grid-template-columns: minmax(0, 1fr);
			grid-template-rows: repeat(var(--selection-count), minmax(0, 1fr));
		}

		.sliding-selection-group::before {
			inline-size: calc(100% - 0.25rem);
			block-size: calc((100% - 0.25rem) / var(--selection-count));
			translate: 0 calc(var(--selection-index) * 100%);
		}
	}
</style>
