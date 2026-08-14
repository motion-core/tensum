<script lang="ts">
	import { Copy01Icon, Tick02Icon } from '@hugeicons/core-free-icons';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import * as Tabs from '$lib/components/ui/tabs';

	const packageManagers = [
		{ name: 'pnpm', command: 'pnpm add @motion-core/spring' },
		{ name: 'npm', command: 'npm install @motion-core/spring' },
		{ name: 'yarn', command: 'yarn add @motion-core/spring' }
	] as const;

	const snippets = {
		core: `import { createSpring } from '@motion-core/spring'

const spring = createSpring({
  from: 0,
  to: 600,
  velocity: 1250,
  mass: 1,
  stiffness: 180,
  damping: 24
})

spring.stateAt(0.25)`,
		runtime: `import { createSpringValue } from '@motion-core/spring-runtime'

const value = createSpringValue(0, parameters, driver)

value.on('change', ({ value, velocity }) => {
  render(value, velocity)
})

value.setTarget(600)`,
		gsap: `import { springTo } from '@motion-core/gsap-spring'

springTo(element, {
  x: 600,
  velocity: { x: 1250 },
  spring: { mass: 1, stiffness: 180, damping: 24 }
})

springTo(element, { x: 100, spring })`
	} as const;

	let packageManagerIndex = $state(0);
	let selectedSnippet = $state<keyof typeof snippets>('core');
	let copied = $state(false);
	let copyTimer: ReturnType<typeof setTimeout> | undefined;
	let currentPackageManager = $derived(packageManagers[packageManagerIndex] ?? packageManagers[0]);

	function cyclePackageManager(): void {
		packageManagerIndex = (packageManagerIndex + 1) % packageManagers.length;
	}

	async function copy(text: string): Promise<void> {
		await navigator.clipboard.writeText(text);
		copied = true;
		if (copyTimer) clearTimeout(copyTimer);
		copyTimer = setTimeout(() => {
			copied = false;
		}, 1600);
	}
</script>

<div class="grid gap-3 lg:grid-cols-[minmax(18rem,0.7fr)_minmax(0,1.3fr)]">
	<Card.Root>
		<Card.Header>
			<Card.Title>Install the physics core</Card.Title>
			<Card.Description>
				Start with the DOM-free solver. Add the runtime or GSAP adapter only when the integration
				needs it.
			</Card.Description>
		</Card.Header>
		<Card.Content>
			<div class="space-y-4">
				<div class="flex flex-wrap gap-2">
					<Button variant="outline" onclick={cyclePackageManager} title="Switch package manager">
						<code>{currentPackageManager.command}</code>
					</Button>
					<Button
						variant="outline"
						size="icon"
						onclick={() => copy(currentPackageManager.command)}
						aria-label="Copy install command"
					>
						<HugeiconsIcon icon={copied ? Tick02Icon : Copy01Icon} strokeWidth={2} />
					</Button>
				</div>

				<p class="text-muted-foreground">
					Select the command to switch package manager. Every package is ESM-only and fully typed.
				</p>

				<div class="grid gap-2">
					<div
						class="flex items-center justify-between gap-3 rounded-md border border-border bg-muted p-3"
					>
						<span>@motion-core/spring</span>
						<span class="text-muted-foreground">zero dependencies</span>
					</div>
					<div
						class="flex items-center justify-between gap-3 rounded-md border border-border bg-muted p-3"
					>
						<span>@motion-core/spring-runtime</span>
						<span class="text-muted-foreground">frame driver</span>
					</div>
					<div
						class="flex items-center justify-between gap-3 rounded-md border border-border bg-muted p-3"
					>
						<span>@motion-core/gsap-spring</span>
						<span class="text-muted-foreground">GSAP peer</span>
					</div>
				</div>
			</div>
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title>Choose the layer you need</Card.Title>
			<Card.Description>
				The same spring state moves from analytical sampling to reactive values and timeline
				composition.
			</Card.Description>
			<Card.Action>
				<Button
					variant="ghost"
					size="icon"
					onclick={() => copy(snippets[selectedSnippet])}
					aria-label="Copy selected code example"
				>
					<HugeiconsIcon icon={copied ? Tick02Icon : Copy01Icon} strokeWidth={2} />
				</Button>
			</Card.Action>
		</Card.Header>
		<Card.Content>
			<Tabs.Root bind:value={selectedSnippet}>
				<Tabs.List aria-label="Package examples">
					<Tabs.Trigger value="core">Core</Tabs.Trigger>
					<Tabs.Trigger value="runtime">Runtime</Tabs.Trigger>
					<Tabs.Trigger value="gsap">GSAP</Tabs.Trigger>
				</Tabs.List>

				{#each Object.entries(snippets) as [name, snippet] (name)}
					<Tabs.Content value={name}>
						<div class="overflow-x-auto rounded-md border border-border bg-muted">
							<pre class="p-4 text-xs/relaxed"><code>{snippet}</code></pre>
						</div>
					</Tabs.Content>
				{/each}
			</Tabs.Root>
		</Card.Content>
	</Card.Root>
</div>

<p class="sr-only" role="status" aria-live="polite">{copied ? 'Copied to clipboard.' : ''}</p>
