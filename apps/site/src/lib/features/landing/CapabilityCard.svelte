<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils';

	type Props = {
		eyebrow: string;
		title: string;
		class?: string;
		visual: Snippet;
		description: Snippet;
	};

	let { eyebrow, title, class: className, visual, description }: Props = $props();
</script>

<article class={cn('min-w-0', className)}>
	{@render visual()}
	<div class="min-h-32 border-t border-border p-4">
		<p class="font-mono text-xs tracking-wider text-muted-foreground">{eyebrow}</p>
		<h3 class="mt-1.5 text-base font-medium">{title}</h3>
		<div class="mt-2 max-w-md text-sm leading-relaxed text-pretty text-muted-foreground">
			{@render description()}
		</div>
	</div>
</article>
