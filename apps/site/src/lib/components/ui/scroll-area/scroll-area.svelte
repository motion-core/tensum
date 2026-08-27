<script lang="ts">
	import { onMount } from 'svelte';
	import { ScrollArea as ScrollAreaPrimitive } from 'bits-ui';
	import { cn, type WithoutChild } from '$lib/utils.js';
	import { Scrollbar } from './index.js';

	let {
		ref = $bindable(null),
		viewportRef = $bindable(null),
		class: className,
		orientation = 'vertical',
		viewportClass,
		viewportTabindex = -1,
		viewportAriaLabel,
		scrollbarXClasses = '',
		scrollbarYClasses = '',
		children,
		...restProps
	}: WithoutChild<ScrollAreaPrimitive.RootProps> & {
		orientation?: 'vertical' | 'horizontal' | 'both' | undefined;
		viewportClass?: string | undefined;
		viewportTabindex?: 0 | -1 | 'auto' | undefined;
		viewportAriaLabel?: string | undefined;
		scrollbarXClasses?: string | undefined;
		scrollbarYClasses?: string | undefined;
		viewportRef?: HTMLElement | null;
	} = $props();

	let viewportScrollable = $state(false);
	let effectiveViewportTabindex = $derived(
		viewportTabindex === 'auto' ? (viewportScrollable ? 0 : -1) : viewportTabindex
	);

	onMount(() => {
		const viewport = viewportRef;
		if (!viewport || viewportTabindex !== 'auto') return;

		const updateScrollableState = () => {
			const overflowsHorizontally = viewport.scrollWidth > viewport.clientWidth;
			const overflowsVertically = viewport.scrollHeight > viewport.clientHeight;

			viewportScrollable =
				orientation === 'horizontal'
					? overflowsHorizontally
					: orientation === 'vertical'
						? overflowsVertically
						: overflowsHorizontally || overflowsVertically;
		};

		const resizeObserver = new ResizeObserver(updateScrollableState);
		resizeObserver.observe(viewport);
		if (viewport.firstElementChild) resizeObserver.observe(viewport.firstElementChild);
		updateScrollableState();

		return () => resizeObserver.disconnect();
	});

	function handleViewportKeydown(event: KeyboardEvent) {
		if (event.target !== event.currentTarget) return;

		const viewport = event.currentTarget as HTMLElement;
		const maxScrollLeft = viewport.scrollWidth - viewport.clientWidth;

		if (maxScrollLeft <= 0) return;

		const scrollStep = Math.max(40, viewport.clientWidth * 0.1);
		let nextScrollLeft: number | undefined;

		switch (event.key) {
			case 'ArrowLeft':
				nextScrollLeft = viewport.scrollLeft - scrollStep;
				break;
			case 'ArrowRight':
				nextScrollLeft = viewport.scrollLeft + scrollStep;
				break;
			case 'Home':
				nextScrollLeft = 0;
				break;
			case 'End':
				nextScrollLeft = maxScrollLeft;
				break;
			default:
				return;
		}

		event.preventDefault();
		viewport.scrollTo({ left: nextScrollLeft });
	}
</script>

<ScrollAreaPrimitive.Root
	bind:ref
	data-slot="scroll-area"
	class={cn('relative', className)}
	{...restProps}
>
	<ScrollAreaPrimitive.Viewport
		bind:ref={viewportRef}
		data-slot="scroll-area-viewport"
		tabindex={effectiveViewportTabindex}
		aria-label={effectiveViewportTabindex === 0 ? viewportAriaLabel : undefined}
		onkeydown={handleViewportKeydown}
		class={cn(
			'cn-scroll-area-viewport size-full rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:ring-inset',
			viewportClass
		)}
	>
		{@render children?.()}
	</ScrollAreaPrimitive.Viewport>
	{#if orientation === 'vertical' || orientation === 'both'}
		<Scrollbar orientation="vertical" class={scrollbarYClasses} />
	{/if}
	{#if orientation === 'horizontal' || orientation === 'both'}
		<Scrollbar orientation="horizontal" class={scrollbarXClasses} />
	{/if}
	<ScrollAreaPrimitive.Corner />
</ScrollAreaPrimitive.Root>
