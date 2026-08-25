<script lang="ts">
	import { resolve } from '$app/paths';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
</script>

<header class="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-lg">
	<nav
		class="mx-auto flex h-14 max-w-4xl items-center justify-between gap-4 px-4"
		aria-label="Primary navigation"
	>
		<a
			href={resolve('/')}
			class="group inline-flex min-h-8 items-center gap-2 rounded-md font-medium tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
			aria-label="Spring home"
		>
			<span class="relative grid size-5 place-items-center" aria-hidden="true">
				<span class="absolute size-3.5 rounded-full border border-foreground/35"></span>
				<span
					class="size-1.5 rounded-full bg-foreground transition-transform duration-150 group-hover:scale-75 motion-reduce:transition-none"
				></span>
			</span>
			<span>@motion-core/spring</span>
		</a>

		<div class="flex items-center gap-1">
			<Badge variant="secondary" class="me-1 hidden sm:inline-flex">v0.1.0</Badge>
			<Button href={resolve('/docs')} variant="ghost" class="hidden sm:inline-flex">Docs</Button>
		</div>
	</nav>
</header>
