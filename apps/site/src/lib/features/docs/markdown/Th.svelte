<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils';

	type Props = Record<string, unknown> & {
		class?: string;
		children?: Snippet;
		scope?: 'col' | 'colgroup' | 'row' | 'rowgroup' | null;
	};
	let { children, scope = 'col', class: className, ...restProps }: Props = $props();
</script>

<th
	{scope}
	{...restProps}
	class={cn('p-2 text-start font-mono text-xs font-medium text-muted-foreground ', className)}
>
	{@render children?.()}
</th>
