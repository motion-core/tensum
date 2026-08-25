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
		'mt-6 rounded-e-lg border-s-2 border-foreground/30 bg-card px-5 py-3 text-base leading-relaxed text-muted-foreground [&>p]:mt-0',
		className
	)}
>
	{@render children?.()}
</blockquote>
