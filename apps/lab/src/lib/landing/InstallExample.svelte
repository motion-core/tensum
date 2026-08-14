<script lang="ts">
	import { Copy01Icon, Tick02Icon } from '@hugeicons/core-free-icons';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { onDestroy } from 'svelte';
	import { Badge } from '$lib/components/ui/badge';
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
	let copiedTarget = $state<'install' | 'code' | null>(null);
	let copyTimer: ReturnType<typeof setTimeout> | undefined;
	let currentPackageManager = $derived(packageManagers[packageManagerIndex] ?? packageManagers[0]);

	function cyclePackageManager(): void {
		packageManagerIndex = (packageManagerIndex + 1) % packageManagers.length;
	}

	async function copy(text: string, target: 'install' | 'code'): Promise<void> {
		await navigator.clipboard.writeText(text);
		copiedTarget = target;
		if (copyTimer) clearTimeout(copyTimer);
		copyTimer = setTimeout(() => {
			copiedTarget = null;
		}, 1600);
	}

	onDestroy(() => {
		if (copyTimer) clearTimeout(copyTimer);
	});
</script>

<div class="grid items-start gap-8 lg:grid-cols-[18rem_minmax(0,1fr)]">
	<div class="space-y-8">
		<div class="space-y-3">
			<div class="space-y-1">
				<p class="font-medium">1. Install the package</p>
				<p class="text-sm text-pretty text-muted-foreground">
					Select the command to switch package manager.
				</p>
			</div>
			<div class="flex flex-wrap gap-2">
				<Button variant="outline" onclick={cyclePackageManager} title="Switch package manager">
					<code>{currentPackageManager.command}</code>
				</Button>
				<Button
					variant="outline"
					size="icon"
					onclick={() => copy(currentPackageManager.command, 'install')}
					aria-label="Copy install command"
				>
					<HugeiconsIcon
						icon={copiedTarget === 'install' ? Tick02Icon : Copy01Icon}
						strokeWidth={2}
					/>
				</Button>
			</div>
		</div>

		<div class="space-y-3">
			<div class="space-y-1">
				<p class="font-medium">2. Choose the owner</p>
				<p class="text-sm text-pretty text-muted-foreground">
					Keep the core DOM-free. Add a runtime or adapter only when another system should own
					frames and writes.
				</p>
			</div>
			<div class="flex flex-wrap gap-2">
				<Badge variant="secondary">core</Badge>
				<Badge variant="outline">runtime</Badge>
				<Badge variant="outline">GSAP</Badge>
			</div>
		</div>
	</div>

	<Card.Root>
		<Card.Header>
			<Card.Title>Package example</Card.Title>
			<Card.Description>
				The same physical state moves from direct sampling to persistent values and GSAP
				composition.
			</Card.Description>
			<Card.Action>
				<Button
					variant="ghost"
					size="icon"
					onclick={() => copy(snippets[selectedSnippet], 'code')}
					aria-label="Copy selected code example"
				>
					<HugeiconsIcon icon={copiedTarget === 'code' ? Tick02Icon : Copy01Icon} strokeWidth={2} />
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

<p class="sr-only" role="status" aria-live="polite">
	{copiedTarget ? 'Copied to clipboard.' : ''}
</p>
