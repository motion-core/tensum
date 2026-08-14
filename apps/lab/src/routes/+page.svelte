<script lang="ts">
	import { ArrowRight02Icon, Atom01Icon } from '@hugeicons/core-free-icons';
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
				'Sample position and velocity from absolute time across underdamped, critical and overdamped regimes. Results do not depend on frame history.',
			package: '@motion-core/spring'
		},
		{
			title: 'Momentum survives interruption',
			description:
				'Retarget from the exact current state. Core, runtime and GSAP preserve both position and physical velocity during a handoff.',
			package: 'retargeting'
		},
		{
			title: 'Physics or perceptual controls',
			description:
				'Use mass, stiffness and damping directly, or convert response, visual duration, perceptual duration and bounce into the same model.',
			package: 'parameter converters'
		},
		{
			title: 'Reactive values and events',
			description:
				'Drive persistent values, additive effects and keyframe sequences. Observe change, logical completion, settlement and unsettled states.',
			package: '@motion-core/spring-runtime'
		},
		{
			title: 'Gestures, inertia and bounds',
			description:
				'Estimate gesture velocity, decay toward a modified target, snap to a grid and transition into boundary springs without hiding the state.',
			package: 'spring runtime'
		},
		{
			title: 'Composition without approximation',
			description:
				'Export adaptive CSS linear() curves, solve coupled systems or hand analytical springs to a seekable and reversible GSAP timeline.',
			package: 'CSS · coupled · GSAP'
		}
	] as const;
</script>

<svelte:head>
	<title>Motion Core — analytical spring physics for the web</title>
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
		class="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3"
		aria-label="Main navigation"
	>
		<div class="flex items-center gap-2">
			<Button href="/" variant="ghost" aria-label="Motion Core home">
				<HugeiconsIcon icon={Atom01Icon} strokeWidth={2} data-icon="inline-start" />
				Motion Core
			</Button>
			<Badge variant="secondary">v0.1.0</Badge>
		</div>

		<div class="hidden items-center sm:flex">
			<Button href="#physics" variant="ghost">Physics</Button>
			<Button href="#features" variant="ghost">Features</Button>
			<Button href="#timeline" variant="ghost">GSAP</Button>
			<Button href="#start" variant="ghost">Install</Button>
		</div>

		<Button href="/lab" variant="outline">Open lab</Button>
	</nav>
</header>

<main id="main-content">
	<section class="mx-auto max-w-6xl px-4 pt-20 pb-16 sm:pt-28 sm:pb-20">
		<div class="mx-auto max-w-4xl text-center">
			<Badge variant="outline">Physics-first motion toolkit</Badge>
			<h1
				class="mt-6 font-heading text-4xl leading-tight font-semibold tracking-tight text-balance sm:text-6xl lg:text-7xl"
			>
				Spring motion that keeps its momentum.
			</h1>
			<p
				class="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-pretty text-muted-foreground sm:text-lg"
			>
				Analytical spring physics for JavaScript, from deterministic sampling to reactive values and
				GSAP timelines. Interrupt motion without inventing the next velocity.
			</p>
			<div class="mt-8 flex flex-wrap items-center justify-center gap-2">
				<Button href="#start">
					Install the core
					<HugeiconsIcon icon={ArrowRight02Icon} strokeWidth={2} data-icon="inline-end" />
				</Button>
				<Button href="/lab" variant="outline">Explore the lab</Button>
			</div>
		</div>

		<div class="mt-14">
			<SpringStudio />
		</div>
	</section>

	<section class="scroll-mt-16 py-20 sm:py-28" id="physics">
		<div class="mx-auto max-w-6xl px-4">
			<div class="mb-10 max-w-2xl">
				<Badge variant="outline">01 · Physical inputs</Badge>
				<h2
					class="mt-4 font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl"
				>
					Tune the behavior, not an easing curve.
				</h2>
				<p class="mt-4 text-base leading-relaxed text-pretty text-muted-foreground">
					Start from familiar duration and bounce controls or supply the physical constants
					directly. Both paths resolve to one inspectable spring.
				</p>
			</div>

			<ParameterPlayground />
		</div>
	</section>

	<section class="scroll-mt-16 py-20 sm:py-28" id="features">
		<div class="mx-auto max-w-6xl px-4">
			<div class="mb-10 max-w-2xl">
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

			<div class="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
				{#each features as feature (feature.title)}
					<Card.Root>
						<Card.Header>
							<Card.Title>{feature.title}</Card.Title>
							<Card.Description>{feature.description}</Card.Description>
							<Card.Action>
								<Badge variant="secondary">{feature.package}</Badge>
							</Card.Action>
						</Card.Header>
					</Card.Root>
				{/each}
			</div>
		</div>
	</section>

	<section class="scroll-mt-16 py-20 sm:py-28" id="timeline">
		<div class="mx-auto max-w-6xl px-4">
			<div class="mb-10 max-w-2xl">
				<Badge variant="outline">03 · Timeline composition</Badge>
				<h2
					class="mt-4 font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl"
				>
					Springs that belong in the timeline.
				</h2>
				<p class="mt-4 text-base leading-relaxed text-pretty text-muted-foreground">
					The `motionSpring` special property participates in GSAP sequencing, seeking and
					reversing. Overlapping children hand off ownership instead of fighting over transforms.
				</p>
			</div>

			<TimelineDemo />
		</div>
	</section>

	<section class="scroll-mt-16 py-20 sm:py-28" id="start">
		<div class="mx-auto max-w-6xl px-4">
			<div class="mb-10 max-w-2xl">
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

<footer class="mx-auto w-full max-w-6xl px-4 pb-8">
	<Separator />
	<div
		class="flex flex-col gap-3 py-6 text-muted-foreground sm:flex-row sm:items-center sm:justify-between"
	>
		<p>Motion Core · MIT licensed</p>
		<nav class="flex flex-wrap gap-3" aria-label="Package links">
			<a class="hover:text-foreground" href="#physics">Spring core</a>
			<a class="hover:text-foreground" href="#features">Runtime</a>
			<a class="hover:text-foreground" href="#timeline">GSAP adapter</a>
			<a class="hover:text-foreground" href={resolve('/lab')}>Lab</a>
		</nav>
	</div>
</footer>
