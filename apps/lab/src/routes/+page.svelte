<script lang="ts">
	import { ArrowRight02Icon } from '@hugeicons/core-free-icons';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { resolve } from '$app/paths';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Separator } from '$lib/components/ui/separator';
	import HeroPlayground from '$lib/landing/HeroPlayground.svelte';
	import InstallExample from '$lib/landing/InstallExample.svelte';

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
			<Button href="#playground" variant="ghost">Playground</Button>
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
	<section
		class="mx-auto max-w-4xl scroll-mt-16 px-4 pt-12 pb-12 sm:pt-16 sm:pb-16"
		id="playground"
	>
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
			<HeroPlayground />
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

			<div class="grid border-y border-border md:grid-cols-3">
				<article class="py-5 md:pr-5">
					<p class="font-mono text-xs text-muted-foreground">duration + bounce</p>
					<h3 class="mt-2 font-heading font-medium">Start from the feel</h3>
					<p class="mt-2 leading-relaxed text-muted-foreground">
						Use product-facing controls, then inspect the resolved mass, stiffness and damping.
					</p>
				</article>
				<article class="border-t border-border py-5 md:border-t-0 md:border-l md:px-5">
					<p class="font-mono text-xs text-muted-foreground">stateAt(t) → x, v</p>
					<h3 class="mt-2 font-heading font-medium">Sample complete state</h3>
					<p class="mt-2 leading-relaxed text-muted-foreground">
						Position and velocity come from absolute time, independent of the browser's frame
						history.
					</p>
				</article>
				<article class="border-t border-border py-5 md:border-t-0 md:border-l md:pl-5">
					<p class="font-mono text-xs text-muted-foreground">retarget(x, v)</p>
					<h3 class="mt-2 font-heading font-medium">Interrupt without a seam</h3>
					<p class="mt-2 leading-relaxed text-muted-foreground">
						A new target inherits the exact current position and velocity instead of restarting
						motion.
					</p>
				</article>
			</div>
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

			<div class="grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
				{#each features as feature (feature.title)}
					<article>
						<div class="flex h-16 items-center" aria-hidden="true">
							{#if feature.visual === 'samples'}
								<p class="font-mono text-muted-foreground tabular-nums">
									60 = 120 = 240 <span class="text-xs">fps</span>
								</p>
							{:else if feature.visual === 'handoff'}
								<div class="w-full">
									<div class="relative h-5 border-b border-border">
										<div
											class="absolute right-1/3 bottom-0 h-8 border-l border-dashed border-muted-foreground"
										></div>
										<div class="absolute bottom-1 left-1/3 h-4 w-8 rounded-sm bg-primary"></div>
									</div>
									<div
										class="mt-2 flex justify-between font-mono text-xs text-muted-foreground tabular-nums"
									>
										<span>x 184.2</span><span>v +612.8</span>
									</div>
								</div>
							{:else if feature.visual === 'layers'}
								<div class="flex flex-wrap items-center gap-2">
									<Badge variant="secondary">core</Badge>
									<span class="text-muted-foreground">→</span>
									<Badge variant="outline">runtime</Badge>
									<Badge variant="outline">GSAP</Badge>
								</div>
							{:else}
								<div class="font-mono text-xs leading-relaxed">
									<p>linear(0, …, 1)</p>
									<p class="text-muted-foreground">motionSpring: &#123; x: 320 &#125;</p>
								</div>
							{/if}
						</div>
						<h3 class="font-heading font-medium">{feature.title}</h3>
						<p class="mt-2 leading-relaxed text-muted-foreground">{feature.description}</p>
					</article>
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

			<div
				class="grid gap-6 border-y border-border py-6 md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]"
			>
				<pre class="overflow-x-auto font-mono text-xs leading-relaxed text-muted-foreground"><code
						><span class="text-foreground">const</span> timeline = gsap.timeline()

timeline.to(node, &#123;
  motionSpring: &#123; x: 320 &#125;
&#125;)

timeline.to(node, &#123;
  motionSpring: &#123; x: 80 &#125;
&#125;, <span class="text-foreground">'&lt;0.35'</span>)</code
					></pre>
				<dl class="grid gap-4 md:border-l md:border-border md:pl-6">
					<div>
						<dt class="font-heading font-medium">One parent clock</dt>
						<dd class="mt-1 text-muted-foreground">
							Play, pause, seek and reverse through GSAP itself.
						</dd>
					</div>
					<div>
						<dt class="font-heading font-medium">Analytical duration</dt>
						<dd class="mt-1 text-muted-foreground">
							Every child reports the duration its spring actually needs.
						</dd>
					</div>
					<div>
						<dt class="font-heading font-medium">Stateful overlap</dt>
						<dd class="mt-1 text-muted-foreground">
							The next spring takes ownership with inherited position and velocity.
						</dd>
					</div>
				</dl>
			</div>
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
			<a class="hover:text-foreground" href="#playground">Spring core</a>
			<a class="hover:text-foreground" href="#features">Runtime</a>
			<a class="hover:text-foreground" href="#timeline">GSAP adapter</a>
			<a class="hover:text-foreground" href={resolve('/lab')}>Lab</a>
		</nav>
	</div>
</footer>
