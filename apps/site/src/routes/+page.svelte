<script lang="ts">
	import { resolve } from '$app/paths';
	import { PageContainer, PageSection, SiteHeader } from '$lib/components/layout';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Separator } from '$lib/components/ui/separator';
	import { CapabilitiesSection, InstallationSection } from '$lib/features/landing';
	import { SpringPlayground } from '$lib/features/playground';

	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
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

<SiteHeader />

<main id="main-content">
	<PageSection id="playground">
		<div class="mx-auto max-w-3xl text-center">
			<Badge variant="outline">Physics-first motion toolkit</Badge>
			<h1 class="mt-4 font-heading text-4xl font-semibold tracking-tight text-balance">
				Spring motion that keeps its momentum.
			</h1>
			<p class="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-pretty text-muted-foreground">
				Analytical spring physics for JavaScript, from deterministic sampling to reactive values and
				GSAP timelines. Interrupt motion without inventing the next velocity.
			</p>
			<div class="mt-6 flex flex-wrap items-center justify-center gap-2">
				<Button href="#capabilities">Explore capabilities</Button>
				<Button href="#get-started" variant="outline">Install the package</Button>
			</div>
		</div>

		<div class="mt-10">
			<SpringPlayground />
		</div>
	</PageSection>

	<CapabilitiesSection />
	<InstallationSection
		installCommand={data.installationCommand.raw}
		setupCode={data.installationCode.raw}
		commandHtmlLight={data.installationCommand.light}
		commandHtmlDark={data.installationCommand.dark}
		htmlLight={data.installationCode.light}
		htmlDark={data.installationCode.dark}
	/>
</main>

<footer>
	<PageContainer class="pb-8 text-xs">
		<Separator />
		<div
			class="flex flex-col gap-3 py-6 text-muted-foreground sm:flex-row sm:items-center sm:justify-between"
		>
			<p>Motion Core / Spring · MIT licensed</p>
			<nav class="flex flex-wrap gap-3" aria-label="Package links">
				<a class="hover:text-foreground" href="#playground">Playground</a>
				<a class="hover:text-foreground" href="#capabilities">Capabilities</a>
				<a class="hover:text-foreground" href="#get-started">Get started</a>
				<a class="hover:text-foreground" href={resolve('/docs')}>Docs</a>
			</nav>
		</div>
	</PageContainer>
</footer>
