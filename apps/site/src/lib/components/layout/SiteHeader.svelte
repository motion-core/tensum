<script lang="ts">
	import { resolve } from '$app/paths';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { ThemeToggle } from '$lib/components/theme-toggle';
	import type { Snippet } from 'svelte';

	let {
		trailingAction,
		hideDefaultActionsOnMobile = false
	}: {
		trailingAction?: Snippet;
		hideDefaultActionsOnMobile?: boolean;
	} = $props();
</script>

<header
	class="sticky top-0 z-40 border-b border-border/64 bg-sidebar/90 backdrop-blur-sm dark:border-card/80"
>
	<nav
		class="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 md:px-6 lg:px-8"
		aria-label="Primary navigation"
	>
		<a
			href={resolve('/')}
			class="group inline-flex min-h-8 min-w-0 items-center gap-2 rounded-md font-medium tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
		>
			<span class="relative grid size-5 shrink-0 place-items-center" aria-hidden="true">
				<span class="absolute size-3.5 rounded-full border border-foreground/35"></span>
				<span
					class="size-1.5 rounded-full bg-foreground transition-transform duration-150 group-hover:scale-75 motion-reduce:transition-none"
				></span>
			</span>
			<span class="truncate">@motion-core/spring</span><span class="sr-only"> home</span>
		</a>

		<div class="flex items-center gap-2 sm:gap-4">
			<Badge
				variant="secondary"
				class={hideDefaultActionsOnMobile ? 'me-1 hidden sm:inline-flex' : 'me-1'}>v0.1.0</Badge
			>
			<Button
				href={resolve('/docs')}
				variant="ghost"
				class={hideDefaultActionsOnMobile ? 'hidden sm:inline-flex' : undefined}>Docs</Button
			>
			<ThemeToggle />
			{@render trailingAction?.()}
		</div>
	</nav>
</header>
