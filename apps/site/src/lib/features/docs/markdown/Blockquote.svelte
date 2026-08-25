<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils';

	type Props = Record<string, unknown> & {
		class?: string;
		children?: Snippet;
	};

	let { children, class: className, ...restProps }: Props = $props();
</script>

<blockquote
	{...restProps}
	class={cn(
		'mt-6 rounded-e-lg border-s-2 border-primary/70 bg-card px-5 py-4 text-base leading-relaxed text-muted-foreground shadow-xs dark:bg-card/44 dark:inset-shadow-[0_1px_rgb(255_255_255/0.15)] [&>p]:mt-0',
		className
	)}
>
	{@render children?.()}
</blockquote>
