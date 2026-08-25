<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils';

	type Props = Record<string, unknown> & { class?: string; children?: Snippet };
	let { children, class: className, ...restProps }: Props = $props();
</script>

<thead {...restProps} class={cn('bg-muted dark:bg-card/48', className)}>
	{@render children?.()}
</thead>
