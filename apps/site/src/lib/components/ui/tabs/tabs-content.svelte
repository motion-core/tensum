<script lang="ts">
	import { Tabs as TabsPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils.js';

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: TabsPrimitive.ContentProps = $props();
</script>

<TabsPrimitive.Content
	bind:ref
	{...restProps}
>
	{#snippet child({ props })}
		<div
			{...props}
			data-slot="tabs-content"
			tabindex="-1"
			class={cn('flex-1 text-sm outline-none', className)}
		>
			{@render children?.()}
		</div>
	{/snippet}
</TabsPrimitive.Content>
