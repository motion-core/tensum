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
		'wrap-break-words rounded-sm bg-background px-1.5 py-0.5 font-mono text-sm font-medium text-secondary-foreground shadow-[0px_0px_0px_1px_rgba(0,0,0,0.04),0_1px_1px_rgba(0,0,0,0.05),0_2px_2px_rgba(0,0,0,0.05),0_2px_4px_rgba(0,0,0,0.05)] dark:bg-card/64 dark:inset-shadow-[0_1px_rgb(255_255_255/0.15)]',
		className
	)}
>
	{@render children?.()}
</code>
