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

<div class="group/heading mt-16 flex items-center gap-1">
	<h2
		{id}
		{...restProps}
		class={cn(
			'scroll-mt-24 font-heading text-2xl leading-tight font-semibold tracking-tight text-balance text-foreground sm:text-3xl',
			className
		)}
	>
		{@render children?.()}
	</h2>
	{#if id}<HeadingAnchor {id} />{/if}
</div>
