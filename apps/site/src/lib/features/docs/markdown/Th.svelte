<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils';

	type Props = Record<string, unknown> & { class?: string; children?: Snippet };
	let { children, class: className, ...restProps }: Props = $props();
</script>

<th
	{...restProps}
	class={cn('p-2 text-start font-mono text-xs font-medium text-muted-foreground ', className)}
>
	{@render children?.()}
</th>
