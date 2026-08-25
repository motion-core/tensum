<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils';

	type Props = Record<string, unknown> & {
		class?: string;
		children?: Snippet;
	};

	let { children, class: className, ...restProps }: Props = $props();
</script>

<a
	{...restProps}
	class={cn(
		'rounded-sm font-medium text-foreground underline decoration-border decoration-1 underline-offset-4 transition-[color,text-decoration-color,box-shadow] duration-150 outline-none hover:decoration-foreground focus-visible:ring-2 focus-visible:ring-ring/40 motion-reduce:transition-none',
		className
	)}
>
	{@render children?.()}
</a>
