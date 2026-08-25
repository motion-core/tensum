<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils';

	type Props = {
		class?: string;
		children: Snippet;
	};

	let { class: className, children }: Props = $props();
</script>

<div
	class={cn(
		'mt-12 overflow-hidden rounded-xl bg-card shadow-lg dark:bg-card/44 dark:inset-shadow-[0_1px_rgb(255_255_255/0.15)]',
		className
	)}
>
	{@render children()}
</div>
