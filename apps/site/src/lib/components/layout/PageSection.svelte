<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils';
	import PageContainer from './PageContainer.svelte';

	type Props = {
		id?: string;
		labelledby?: string;
		class?: string;
		contentClass?: string;
		children: Snippet;
	};

	let { id, labelledby, class: className, contentClass, children }: Props = $props();
</script>

<section {id} aria-labelledby={labelledby} class={cn('scroll-mt-16', className)}>
	<PageContainer class={cn('py-12 sm:py-16', contentClass)}>
		{@render children()}
	</PageContainer>
</section>
