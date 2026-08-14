<script lang="ts">
	import { ArrowRight02Icon } from '@hugeicons/core-free-icons';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { resolve } from '$app/paths';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Separator } from '$lib/components/ui/separator';
	import InstallExample from '$lib/landing/InstallExample.svelte';
	import ParameterPlayground from '$lib/landing/ParameterPlayground.svelte';
	import SpringStudio from '$lib/landing/SpringStudio.svelte';
	import TimelineDemo from '$lib/landing/TimelineDemo.svelte';

	const features = [
		{
			title: 'Analytical at every instant',
			description:
				'Sample position and velocity from absolute time. The result does not depend on frame history.',
			visual: 'samples'
		},
		{
			title: 'Momentum survives interruption',
			description:
				'Retarget from the exact current state and carry physical velocity into the next spring.',
			visual: 'handoff'
		},
		{
			title: 'Small core, optional owners',
			description:
				'Keep the solver DOM-free. Add runtime or GSAP only when they should own frames and writes.',
			visual: 'layers'
		},
		{
			title: 'Composition without approximation',
			description:
				'Export adaptive CSS linear() curves or place the same solver inside a seekable GSAP timeline.',
			visual: 'composition'
		}
	] as const;
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
		class="relative mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3"
		aria-label="Main navigation"
	>
		<div class="flex items-center gap-2">
			<Button href="/" variant="ghost" aria-label="Spring home">@motion-core/spring</Button>
		</div>

		<div class="absolute left-1/2 hidden -translate-x-1/2 items-center md:flex">
			<Button href="#physics" variant="ghost">Physics</Button>
			<Button href="#features" variant="ghost">Features</Button>
			<Button href="#timeline" variant="ghost">GSAP</Button>
			<Button href="#start" variant="ghost">Install</Button>
		</div>

		<div class="flex items-center gap-2">
			<Badge class="hidden sm:inline-flex" variant="secondary">v0.1.0</Badge>
			<Button href="/lab" variant="outline">Open lab</Button>
		</div>
	</nav>
</header>

<main id="main-content">
	<section class="mx-auto max-w-4xl px-4 pt-12 pb-12 sm:pt-16 sm:pb-16">
		<div class="mx-auto max-w-3xl text-center">
			<Badge variant="outline">Physics-first motion toolkit</Badge>
			<h1 class="mt-4 font-heading text-5xl font-semibold tracking-tight text-balance">
				Spring motion that keeps its momentum.
			</h1>
			<p class="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-pretty text-muted-foreground">
				Analytical spring physics for JavaScript, from deterministic sampling to reactive values and
				GSAP timelines. Interrupt motion without inventing the next velocity.
			</p>
			<div class="mt-6 flex flex-wrap items-center justify-center gap-2">
				<Button href="#start">
					Install the core
					<HugeiconsIcon icon={ArrowRight02Icon} strokeWidth={2} data-icon="inline-end" />
				</Button>
				<Button href="/lab" variant="outline">Explore the lab</Button>
			</div>
		</div>

		<div class="mt-10">
			<SpringStudio />
		</div>
	</section>

	<section class="scroll-mt-16 py-12 sm:py-16" id="physics">
		<div class="mx-auto max-w-4xl px-4">
			<div class="mb-8 grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-end">
				<div>
					<Badge variant="outline">01 · Physical inputs</Badge>
					<h2
						class="mt-4 font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl"
					>
						Tune the behavior, not an easing curve.
					</h2>
				</div>
				<p class="text-base leading-relaxed text-pretty text-muted-foreground lg:pb-1">
					Start from familiar duration and bounce controls or supply the physical constants
					directly. Both paths resolve to one inspectable spring.
				</p>
			</div>

			<ParameterPlayground />
		</div>
	</section>

	<section class="scroll-mt-16 py-12 sm:py-16" id="features">
		<div class="mx-auto max-w-4xl px-4">
			<div class="mb-8 max-w-2xl">
				<Badge variant="outline">02 · Complete motion state</Badge>
				<h2
					class="mt-4 font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl"
				>
					A solver at the center, integrations at the edges.
				</h2>
				<p class="mt-4 text-base leading-relaxed text-pretty text-muted-foreground">
					Use the smallest layer that owns the job. The core stays DOM-free while optional packages
					add frames, gestures, inertia and timeline composition.
				</p>
			</div>

			<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
				{#each features as feature (feature.title)}
					<Card.Root size="sm">
						<Card.Content>
							<div
								class="flex min-h-24 items-center justify-center rounded-md border border-border bg-muted"
								aria-hidden="true"
							>
								{#if feature.visual === 'samples'}
									<div class="grid w-full grid-cols-3 gap-2 text-center">
										<div>
											<p class="text-muted-foreground">60 fps</p>
											<p class="font-mono text-foreground tabular-nums">0.742</p>
										</div>
										<div>
											<p class="text-muted-foreground">120 fps</p>
											<p class="font-mono text-foreground tabular-nums">0.742</p>
										</div>
										<div>
											<p class="text-muted-foreground">240 fps</p>
											<p class="font-mono text-foreground tabular-nums">0.742</p>
										</div>
									</div>
								{:else if feature.visual === 'handoff'}
									<div class="w-full space-y-2 px-3">
										<div class="relative h-5">
											<div class="absolute inset-x-0 top-1/2 border-t border-border"></div>
											<div
												class="absolute top-1/2 left-2/3 h-8 -translate-y-full border-l border-dashed border-muted-foreground"
											></div>
											<div
												class="absolute bottom-1/2 left-1/3 mb-1 h-4 w-8 rounded-sm bg-primary"
											></div>
										</div>
										<div class="flex justify-between font-mono text-muted-foreground tabular-nums">
											<span>x 184.2</span>
											<span>v +612.8</span>
										</div>
									</div>
								{:else if feature.visual === 'layers'}
									<div class="flex flex-wrap items-center justify-center gap-2">
										<Badge variant="secondary">core</Badge>
										<span class="text-muted-foreground">→</span>
										<Badge variant="outline">runtime</Badge>
										<Badge variant="outline">GSAP</Badge>
									</div>
								{:else}
									<div class="w-full space-y-2 px-3 font-mono">
										<div class="rounded-sm bg-secondary px-2 py-1">linear(0, …, 1)</div>
										<div class="ml-8 rounded-sm bg-primary px-2 py-1 text-primary-foreground">
											motionSpring
										</div>
									</div>
								{/if}
							</div>
						</Card.Content>
						<Card.Header>
							<Card.Title>{feature.title}</Card.Title>
							<Card.Description>{feature.description}</Card.Description>
						</Card.Header>
					</Card.Root>
				{/each}
			</div>
		</div>
	</section>

	<section class="scroll-mt-16 py-12 sm:py-16" id="timeline">
		<div class="mx-auto max-w-4xl px-4">
			<div class="mb-8 grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-end">
				<div>
					<Badge variant="outline">03 · Timeline composition</Badge>
					<h2
						class="mt-4 font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl"
					>
						Springs that belong in the timeline.
					</h2>
				</div>
				<p class="text-base leading-relaxed text-pretty text-muted-foreground lg:pb-1">
					The <code>motionSpring</code> special property participates in GSAP sequencing, seeking and
					reversing. Overlapping children hand off ownership instead of fighting over transforms.
				</p>
			</div>

			<TimelineDemo />
		</div>
	</section>

	<section class="scroll-mt-16 py-12 sm:py-16" id="start">
		<div class="mx-auto max-w-4xl px-4">
			<div class="mb-8 max-w-2xl">
				<Badge variant="outline">04 · Get started</Badge>
				<h2
					class="mt-4 font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl"
				>
					Start from state, target and time.
				</h2>
				<p class="mt-4 text-base leading-relaxed text-pretty text-muted-foreground">
					Install the analytical core first. Add a runtime or adapter when another system should own
					the clock and property writes.
				</p>
			</div>

			<InstallExample />
		</div>
	</section>
</main>

<footer class="mx-auto w-full max-w-4xl px-4 pb-8 text-xs">
	<Separator />
	<div
		class="flex flex-col gap-3 py-6 text-muted-foreground sm:flex-row sm:items-center sm:justify-between"
	>
		<p>Motion Core / Spring · MIT licensed</p>
		<nav class="flex flex-wrap gap-3" aria-label="Package links">
			<a class="hover:text-foreground" href="#physics">Spring core</a>
			<a class="hover:text-foreground" href="#features">Runtime</a>
			<a class="hover:text-foreground" href="#timeline">GSAP adapter</a>
			<a class="hover:text-foreground" href={resolve('/lab')}>Lab</a>
		</nav>
	</div>
</footer>
