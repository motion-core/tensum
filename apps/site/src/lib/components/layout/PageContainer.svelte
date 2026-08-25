<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils';

	type Props = {
		class?: string;
		children: Snippet;
	};

	let { class: className, children }: Props = $props();
</script>

<div class={cn('mx-auto w-full max-w-4xl px-4', className)}>
	{@render children()}
</div>
