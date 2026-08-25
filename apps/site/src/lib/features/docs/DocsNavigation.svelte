<script lang="ts">
	import { createSpring } from '@motion-core/spring';
	import { springToCSSLinear } from '@motion-core/spring/css';
	import { docsNavigationItems } from './navigation';

	type Props = {
		activeId: string;
		onNavigate?: () => void;
	};

	let { activeId, onNavigate }: Props = $props();

	const lineMotion = springToCSSLinear(
		createSpring({
			from: 0,
			to: 1,
			mass: 1,
			stiffness: 200,
			damping: 20
		}),
		{ maxError: 0.004, precision: 5 }
	);
	const lineMotionStyles = `--docs-nav-line-duration: ${lineMotion.duration}s; --docs-nav-line-easing: ${lineMotion.easing}`;
</script>

<nav aria-label="Documentation" style={lineMotionStyles}>
	<div class="flex flex-col gap-2 py-5 ps-3 pe-0.5">
		{#each docsNavigationItems as item, index (item.id)}
			<a
				href={`#${item.id}`}
				aria-current={activeId === item.id ? 'location' : undefined}
				onclick={onNavigate}
				class="group/nav-item relative flex h-px items-center gap-3 outline-none after:absolute after:start-0 after:top-1/2 after:size-full after:-translate-y-1/2 after:p-3.5 focus-visible:after:rounded-sm focus-visible:after:ring-2 focus-visible:after:ring-ring/40"
			>
				<span
					class={activeId === item.id
						? 'docs-nav-line block h-px w-10 shrink-0 bg-foreground motion-reduce:transition-none'
						: 'docs-nav-line block h-px w-6 shrink-0 bg-foreground/20 group-hover/nav-item:w-10 group-hover/nav-item:bg-foreground group-focus-visible/nav-item:w-10 group-focus-visible/nav-item:bg-foreground motion-reduce:transition-none'}
					aria-hidden="true"
				></span>
				<span
					class={activeId === item.id
						? 'text-sm whitespace-nowrap text-foreground transition-colors duration-150 ease-out motion-reduce:transition-none'
						: 'text-sm whitespace-nowrap text-muted-foreground transition-colors duration-150 ease-out group-hover/nav-item:text-foreground group-focus-visible/nav-item:text-foreground motion-reduce:transition-none'}
				>
					{item.label}
				</span>
			</a>

			{#if index !== docsNavigationItems.length - 1}
				<span class="block h-px w-6 bg-foreground/20" aria-hidden="true"></span>
				<span class="block h-px w-6 bg-foreground/20" aria-hidden="true"></span>
			{/if}
		{/each}
	</div>
</nav>

<style>
	.docs-nav-line {
		transition-property: width, background-color;
		transition-duration: var(--docs-nav-line-duration), 150ms;
		transition-timing-function: var(--docs-nav-line-easing), cubic-bezier(0, 0, 0.2, 1);
	}
</style>
