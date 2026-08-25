<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount, type Snippet } from 'svelte';
	import DocsNavigation from './DocsNavigation.svelte';
	import { ActionTooltip } from '$lib/components/action-tooltip';
	import { PageContainer, SiteHeader } from '$lib/components/layout';
	import { Button, buttonVariants } from '$lib/components/ui/button';
	import * as Drawer from '$lib/components/ui/drawer';
	import { CloseIcon, MenuIcon } from '$lib/icons';
	import { ScrollArea } from '$lib/components/ui/scroll-area';
	import { cn } from '$lib/utils.js';
	import { docsNavigationItems } from './navigation';

	let { children }: { children: Snippet } = $props();

	let activeId = $state('overview');
	let mobileOpen = $state(false);
	let mobileCloseButton: HTMLElement | null = $state(null);

	function focusMobileNavigation(event: Event) {
		event.preventDefault();
		window.requestAnimationFrame(() => mobileCloseButton?.focus());
	}

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

<Drawer.Root bind:open={mobileOpen} direction="left" shouldScaleBackground={false} autoFocus>
	<SiteHeader hideDefaultActionsOnMobile>
		{#snippet trailingAction()}
			<ActionTooltip content="Open documentation navigation" side="bottom">
				{#snippet trigger({ props })}
					<Drawer.Trigger
						{...props}
						class={cn(
							buttonVariants({ variant: 'ghost', size: 'icon' }),
							'-me-2 size-10 xl:hidden'
						)}
						aria-label="Open documentation navigation"
					>
						<MenuIcon strokeWidth={1.5} />
					</Drawer.Trigger>
				{/snippet}
			</ActionTooltip>
		{/snippet}
	</SiteHeader>

	<Drawer.Content
		class="isolate h-dvh w-72 max-w-[calc(100vw-0.5rem)] sm:max-w-72"
		onOpenAutoFocus={focusMobileNavigation}
	>
		<Drawer.Header class="flex-row items-center justify-between border-b border-border px-4 py-3">
			<div class="min-w-0">
				<Drawer.Title>Spring documentation</Drawer.Title>
				<Drawer.Description class="sr-only">
					Navigate to a documentation section.
				</Drawer.Description>
			</div>
			<ActionTooltip content="Close documentation navigation" side="left">
				{#snippet trigger({ props })}
					<Drawer.Close
						{...props}
						bind:ref={mobileCloseButton}
						class={buttonVariants({ variant: 'ghost', size: 'icon-lg' })}
						aria-label="Close documentation navigation"
					>
						<CloseIcon strokeWidth={1.5} />
					</Drawer.Close>
				{/snippet}
			</ActionTooltip>
		</Drawer.Header>
		<ScrollArea class="min-h-0 flex-1">
			<div class="px-3 py-4">
				<DocsNavigation {activeId} onNavigate={() => (mobileOpen = false)} />
			</div>
		</ScrollArea>
	</Drawer.Content>
</Drawer.Root>

<main
	class="relative mx-auto max-w-screen-2xl xl:grid xl:grid-cols-[minmax(15.5rem,1fr)_minmax(0,64rem)_minmax(15.5rem,1fr)]"
>
	<aside class="relative hidden min-w-0 ps-4 xl:block" aria-label="Documentation sections">
		<div class="sticky top-[50dvh] isolate w-62 -translate-y-1/2">
			<div
				id="desktop-docs-navigation"
				class={[
					'relative flex max-h-[calc(100dvh-7rem)] w-60 flex-col transition-[translate] duration-350 ease-[cubic-bezier(0.24,0.88,0.28,0.92)] motion-reduce:transition-none'
				]}
			>
				<ScrollArea
					class="min-h-0 w-full overscroll-contain"
					viewportClass="max-h-[calc(100dvh-7rem)]"
				>
					<DocsNavigation {activeId} />
				</ScrollArea>
			</div>
		</div>
	</aside>

	<PageContainer class="min-w-0 pt-10 pb-16 sm:pt-14 lg:pt-16 lg:pb-24">
		<div id="docs-content" tabindex="-1" class="mx-auto max-w-2xl outline-none">
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
