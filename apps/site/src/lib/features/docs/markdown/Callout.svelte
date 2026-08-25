<script lang="ts">
	import { Alert02Icon, InformationCircleIcon } from '@hugeicons/core-free-icons';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import type { Snippet } from 'svelte';

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

<aside class="mt-7 flex items-start gap-3 rounded-lg bg-card p-2 shadow-sm" aria-label={title}>
	<span
		class={kind === 'warning'
			? 'mt-0.5 text-amber-600 dark:text-amber-400'
			: 'mt-0.5 text-muted-foreground'}
		aria-hidden="true"
	>
		<HugeiconsIcon
			class="size-4"
			icon={kind === 'warning' ? Alert02Icon : InformationCircleIcon}
			strokeWidth={1.5}
		/>
	</span>
	<div class="min-w-0">
		<p class="text-sm font-semibold text-foreground">{title}</p>
		<div class="mt-1 text-sm leading-relaxed text-muted-foreground [&>p]:mt-0">
			{@render children()}
		</div>
	</div>
</aside>
