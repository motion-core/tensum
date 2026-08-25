<script lang="ts">
	import { resolve } from '$app/paths';
	import { PageContainer, PageMetadata, PageSection, SiteHeader } from '$lib/components/layout';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Separator } from '$lib/components/ui/separator';
	import { CapabilitiesSection, InstallationSection } from '$lib/features/landing';
	import { SpringPlayground } from '$lib/features/playground';

	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<PageMetadata
	title="Tensum — analytical spring physics for the web"
	description="Analytical spring physics with continuous retargeting, reactive values, CSS export, and native GSAP timeline composition."
	path="/"
/>

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
		<div class="mx-auto max-w-4xl text-center">
			<Badge variant="secondary">Physics-first motion toolkit</Badge>
			<h1
				class="mt-5 font-heading text-5xl leading-none font-semibold tracking-tight text-balance sm:text-6xl"
			>
				Spring motion that keeps its momentum.
			</h1>
			<p class="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-pretty text-muted-foreground">
				Analytical spring physics for JavaScript, from deterministic sampling to reactive values and
				GSAP timelines. Interrupt motion without inventing the next velocity.
			</p>
			<div class="mt-8 flex flex-wrap items-center justify-center gap-3">
				<Button href="#capabilities">Explore capabilities</Button>
				<Button href="#get-started" variant="ghost">Install the package</Button>
			</div>
		</div>

		<div class="mt-12">
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
	<PageContainer class="pb-8 text-sm">
		<Separator />
		<div
			class="flex flex-col gap-3 py-6 text-muted-foreground sm:flex-row sm:items-center sm:justify-between"
		>
			<p>Tensum · MIT licensed</p>
			<nav class="flex flex-wrap gap-3" aria-label="Package links">
				<a class="hover:text-foreground" href="#playground">Playground</a>
				<a class="hover:text-foreground" href="#capabilities">Capabilities</a>
				<a class="hover:text-foreground" href="#get-started">Get started</a>
				<a class="hover:text-foreground" href={resolve('/docs')}>Docs</a>
			</nav>
		</div>
	</PageContainer>
</footer>
