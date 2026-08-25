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
	class={cn('h-12 px-3 text-start text-sm font-medium text-muted-foreground', className)}
>
	{@render children?.()}
</th>
