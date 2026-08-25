<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils';

	type Props = Record<string, unknown> & { class?: string; children?: Snippet };
	let { children, class: className, ...restProps }: Props = $props();
</script>

<tbody {...restProps} class={cn('[&>tr:last-child]:border-b-0', className)}>
	{@render children?.()}
</tbody>
