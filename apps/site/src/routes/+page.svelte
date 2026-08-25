<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Separator } from '$lib/components/ui/separator';
	import { SpringPlayground } from '$lib/features/playground';
</script>

<svelte:head>
	<title>Spring by Motion Core — analytical spring physics for the web</title>
	<meta
		name="description"
		content="Analytical spring physics with continuous retargeting, reactive values, CSS export, and native GSAP timeline composition."
	/>
</svelte:head>

<Button
	href="#main-content"
	variant="secondary"
	class="fixed top-2 left-2 z-50 -translate-y-20 focus:translate-y-0"
>
	Skip to content
</Button>

<header class="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
	<nav
		class="relative mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3"
		aria-label="Main navigation"
	>
		<div class="flex items-center gap-2">
			<Button href="/" variant="ghost" aria-label="Spring home">@motion-core/spring</Button>
		</div>

		<div class="absolute left-1/2 hidden -translate-x-1/2 items-center md:flex">
			<Button href="#playground" variant="ghost">Playground</Button>
		</div>

		<div class="flex items-center gap-2">
			<Badge class="hidden sm:inline-flex" variant="secondary">v0.1.0</Badge>
		</div>
	</nav>
</header>

<main id="main-content">
	<section
		class="mx-auto max-w-5xl scroll-mt-16 px-4 pt-12 pb-12 sm:pt-16 sm:pb-16"
		id="playground"
	>
		<div class="mx-auto max-w-3xl text-center">
			<Badge variant="outline">Physics-first motion toolkit</Badge>
			<h1 class="mt-4 font-heading text-4xl font-semibold tracking-tight text-balance">
				Spring motion that keeps its momentum.
			</h1>
			<p class="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-pretty text-muted-foreground">
				Analytical spring physics for JavaScript, from deterministic sampling to reactive values and
				GSAP timelines. Interrupt motion without inventing the next velocity.
			</p>
		</div>

		<div class="mt-10">
			<SpringPlayground />
		</div>
	</section>
</main>

<footer class="mx-auto w-full max-w-5xl px-4 pb-8 text-xs">
	<Separator />
	<div
		class="flex flex-col gap-3 py-6 text-muted-foreground sm:flex-row sm:items-center sm:justify-between"
	>
		<p>Motion Core / Spring · MIT licensed</p>
		<nav class="flex flex-wrap gap-3" aria-label="Package links">
			<a class="hover:text-foreground" href="#playground">Spring core</a>
		</nav>
	</div>
</footer>
