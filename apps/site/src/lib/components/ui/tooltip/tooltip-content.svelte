<script lang="ts">
	import { Tooltip as TooltipPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils.js';
	import type { WithoutChildrenOrChild } from '$lib/utils.js';
	import TooltipPortal from './tooltip-portal.svelte';
	import type { ComponentProps } from 'svelte';

	let {
		ref = $bindable(null),
		class: className,
		sideOffset = 4,
		side = 'top',
		children,
		showArrow = false,
		arrowClasses,
		portalProps,
		...restProps
	}: TooltipPrimitive.ContentProps & {
		showArrow?: boolean;
		arrowClasses?: string;
		portalProps?: WithoutChildrenOrChild<ComponentProps<typeof TooltipPortal>>;
	} = $props();
</script>

<TooltipPortal {...portalProps}>
	<TooltipPrimitive.Content
		bind:ref
		data-slot="tooltip-content"
		{sideOffset}
		{side}
		class={cn(
			'relative z-50 inline-flex w-fit max-w-70 origin-(--bits-tooltip-content-transform-origin) items-center gap-1.5 rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-lg has-data-[slot=kbd]:pr-1.5 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 **:data-[slot=kbd]:relative **:data-[slot=kbd]:isolate **:data-[slot=kbd]:z-50 **:data-[slot=kbd]:rounded-sm data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
			className
		)}
		{...restProps}
	>
		{@render children?.()}
		{#if showArrow}
			<TooltipPrimitive.Arrow
				class={cn('fill-popover drop-shadow-[0_1px_0_var(--border)]', arrowClasses)}
			/>
		{/if}
	</TooltipPrimitive.Content>
</TooltipPortal>
