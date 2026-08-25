<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils';

	type Props = Record<string, unknown> & { class?: string; children?: Snippet };
	let { children, class: className, ...restProps }: Props = $props();
</script>

<tr
	{...restProps}
	class={cn(
		'border-b border-border/64 dark:border-card/80',
		className
	)}
>
	{@render children?.()}
</tr>
