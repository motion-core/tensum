<script lang="ts">
	import type { Snippet } from 'svelte';
	import HeadingAnchor from './HeadingAnchor.svelte';
	import { cn } from '$lib/utils';

	type Props = Record<string, unknown> & {
		id?: string;
		class?: string;
		children?: Snippet;
	};

	let { children, id, class: className, ...restProps }: Props = $props();
</script>

<div class="group/heading mt-11 flex items-center">
	<h3
		{id}
		{...restProps}
		class={cn(
			'scroll-mt-24 font-heading text-xl leading-tight font-semibold tracking-tight text-balance text-foreground',
			className
		)}
	>
		{@render children?.()}
	</h3>
	{#if id}<HeadingAnchor {id} />{/if}
</div>
