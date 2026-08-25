<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils';

	type Props = Record<string, unknown> & {
		class?: string;
		children?: Snippet;
	};

	let { children, class: className, ...restProps }: Props = $props();
</script>

<code
	{...restProps}
	class={cn(
		'wrap-break-words rounded-sm bg-secondary px-1.5 py-0.5 font-mono text-sm font-medium text-secondary-foreground',
		className
	)}
>
	{@render children?.()}
</code>
