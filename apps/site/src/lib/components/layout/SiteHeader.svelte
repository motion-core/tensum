<script lang="ts">
	import { resolve } from '$app/paths';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { ThemeToggle } from '$lib/components/theme-toggle';
	import { TensumIcon } from '$lib/icons';
	import type { Snippet } from 'svelte';

	let {
		trailingAction,
		hideDefaultActionsOnMobile = false
	}: {
		trailingAction?: Snippet;
		hideDefaultActionsOnMobile?: boolean;
	} = $props();
</script>

<header class="sticky top-0 z-40 px-3 pt-3 md:px-4">
	<nav
		class="mx-auto flex h-12 max-w-3xl items-center justify-between gap-3 rounded-xl bg-background/80 px-2.5 shadow-lg backdrop-blur-xl backdrop-saturate-150 dark:border-card/80 dark:bg-card/44 dark:inset-shadow-[0_1px_rgb(255_255_255/0.15)]"
		aria-label="Primary navigation"
	>
		<a
			href={resolve('/')}
			class="group inline-flex min-h-8 min-w-0 items-center gap-2 rounded-md px-1.5 font-medium tracking-tight outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
		>
			<TensumIcon size={18} class="shrink-0 text-foreground" />
			<span class="truncate">tensum</span><span class="sr-only"> home</span>
		</a>

		<div class="flex items-center gap-1">
			<Badge
				variant="secondary"
				class={hideDefaultActionsOnMobile ? 'me-1 hidden sm:inline-flex' : 'me-1'}
				>v0.1.0-beta.0</Badge
			>
			<Button
				href={resolve('/docs')}
				variant="ghost"
				size="sm"
				class={hideDefaultActionsOnMobile ? 'hidden sm:inline-flex' : undefined}>Docs</Button
			>
			<ThemeToggle />
			{@render trailingAction?.()}
		</div>
	</nav>
</header>
