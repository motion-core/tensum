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
	<div class="min-h-36 border-t border-border/64 p-6 dark:border-card/80">
		<p class="font-mono text-xs text-muted-foreground">{eyebrow}</p>
		<h3 class="mt-2 text-lg font-semibold">{title}</h3>
		<div class="mt-3 max-w-lg text-sm leading-relaxed text-pretty text-muted-foreground">
			{@render description()}
		</div>
	</div>
</article>
