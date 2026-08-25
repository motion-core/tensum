<script lang="ts">
	import { Menu04Icon } from '@hugeicons/core-free-icons';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { resolve } from '$app/paths';
	import { onMount, type Snippet } from 'svelte';
	import DocsNavigation from './DocsNavigation.svelte';
	import { PageContainer, SiteHeader } from '$lib/components/layout';
	import { Button } from '$lib/components/ui/button';
	import { ScrollArea } from '$lib/components/ui/scroll-area';
	import * as Sheet from '$lib/components/ui/sheet';
	import { docsNavigationItems } from './navigation';

	let { children }: { children: Snippet } = $props();

	let activeId = $state('overview');
	let mobileOpen = $state(false);

	onMount(() => {
		let frame: number | undefined;

		const updateActiveSection = () => {
			frame = undefined;
			const activationLine = window.scrollY + 112;
			let nextId = docsNavigationItems[0]?.id ?? 'overview';

			for (const item of docsNavigationItems) {
				const section = document.getElementById(item.id);
				if (section && section.offsetTop <= activationLine) nextId = item.id;
			}

			if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 8) {
				nextId = docsNavigationItems.at(-1)?.id ?? nextId;
			}

			activeId = nextId;
		};

		const queueUpdate = () => {
			if (frame !== undefined) return;
			frame = window.requestAnimationFrame(updateActiveSection);
		};

		window.addEventListener('scroll', queueUpdate, { passive: true });
		window.addEventListener('resize', queueUpdate);
		updateActiveSection();

		return () => {
			window.removeEventListener('scroll', queueUpdate);
			window.removeEventListener('resize', queueUpdate);
			if (frame !== undefined) window.cancelAnimationFrame(frame);
		};
	});
</script>

<Button
	href="#docs-content"
	variant="secondary"
	class="fixed inset-s-2 top-2 z-50 -translate-y-20 focus:translate-y-0"
>
	Skip to documentation
</Button>

<SiteHeader />

<main
	class="relative mx-auto max-w-screen-2xl xl:grid xl:grid-cols-[minmax(15.5rem,1fr)_minmax(0,64rem)_minmax(15.5rem,1fr)]"
>
	<aside class="relative hidden min-w-0 ps-1 pb-4 xl:block" aria-label="Documentation sections">
		<div
			class="sticky top-(--docs-sidebar-top) isolate flex h-[calc(100svh-var(--docs-sidebar-top)-var(--docs-sidebar-bottom))] min-h-80 w-62 flex-col [--docs-sidebar-bottom:6rem] [--docs-sidebar-top:calc(3.5rem+3rem+0.1875rem)]"
		>
			<div
				id="desktop-docs-navigation"
				class={[
					'relative flex h-full w-60 flex-col transition-[translate] duration-350 ease-[cubic-bezier(0.24,0.88,0.28,0.92)] motion-reduce:transition-none'
				]}
			>
				<div
					class="docs-sidebar-scroll min-h-0 grow overflow-x-clip overflow-y-auto overscroll-contain pt-10"
				>
					<DocsNavigation {activeId} />
				</div>
			</div>
		</div>
	</aside>

	<PageContainer class="min-w-0 pt-10 pb-16 sm:pt-14 lg:pt-16 lg:pb-24">
		<div class="mb-8 flex items-center xl:hidden">
			<Sheet.Root bind:open={mobileOpen}>
				<Sheet.Trigger>
					{#snippet child({ props })}
						<Button {...props} variant="outline" aria-label="Open documentation navigation">
							<HugeiconsIcon icon={Menu04Icon} strokeWidth={1.5} data-icon="inline-start" />
							Documentation
						</Button>
					{/snippet}
				</Sheet.Trigger>
				<Sheet.Content side="left" class="w-72 max-w-full p-0 sm:max-w-72">
					<Sheet.Header class="border-b border-border px-5 py-4 text-start">
						<Sheet.Title>Spring documentation</Sheet.Title>
						<Sheet.Description class="sr-only">
							Navigate to a documentation section.
						</Sheet.Description>
					</Sheet.Header>
					<ScrollArea class="min-h-0 flex-1">
						<div class="px-4 py-5">
							<DocsNavigation {activeId} onNavigate={() => (mobileOpen = false)} />
						</div>
					</ScrollArea>
				</Sheet.Content>
			</Sheet.Root>
		</div>

		<div id="docs-content" tabindex="-1" class="outline-none">
			{@render children()}
		</div>

		<footer class="mt-20 border-t border-border pt-6 text-xs text-muted-foreground">
			<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<p>Motion Core / Spring · MIT licensed</p>
				<nav class="flex flex-wrap gap-x-4 gap-y-2" aria-label="Documentation footer">
					<a class="hover:text-foreground" href={resolve('/')}>Home</a>
					<a class="hover:text-foreground" href={resolve('/#playground')}>Playground</a>
					<a class="hover:text-foreground" href="#overview">Back to top</a>
				</nav>
			</div>
		</footer>
	</PageContainer>

	<div class="hidden xl:block" aria-hidden="true"></div>
</main>

<style>
	.docs-sidebar-scroll {
		scrollbar-width: none;
	}

	.docs-sidebar-scroll::-webkit-scrollbar {
		display: none;
	}
</style>
