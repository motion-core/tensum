<script lang="ts">
	import type { Snippet } from 'svelte';
	import { InfoIcon, WarningIcon } from '$lib/icons';

	let {
		title,
		kind = 'note',
		children
	}: {
		title: string;
		kind?: 'note' | 'warning';
		children: Snippet;
	} = $props();
</script>

<aside
	class="mt-8 flex items-start gap-3 rounded-xl bg-card p-5 shadow-lg dark:bg-card/44 dark:inset-shadow-[0_1px_rgb(255_255_255/0.15)]"
	aria-label={title}
>
	<span
		class={kind === 'warning'
			? 'mt-0.5 text-amber-600 dark:text-amber-400'
			: 'mt-0.5 text-muted-foreground'}
		aria-hidden="true"
	>
		{#if kind === 'warning'}
			<WarningIcon class="size-4" strokeWidth={1.5} />
		{:else}
			<InfoIcon class="size-4" strokeWidth={1.5} />
		{/if}
	</span>
	<div class="min-w-0">
		<p class="text-sm font-semibold text-foreground">{title}</p>
		<div class="mt-1 text-sm leading-relaxed text-muted-foreground [&>p]:mt-0">
			{@render children()}
		</div>
	</div>
</aside>
