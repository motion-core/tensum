<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils';

	type Props = Record<string, unknown> & { class?: string; children?: Snippet };
	let { children, class: className, ...restProps }: Props = $props();
</script>

<td {...restProps} class={cn('p-3 align-top leading-relaxed text-muted-foreground', className)}>
	{@render children?.()}
</td>
