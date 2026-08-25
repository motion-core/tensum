<script lang="ts">
	import { cn } from '$lib/utils';
	import { ScrollArea } from '$lib/components/ui/scroll-area';
	import CopyCodeButton from './CopyCodeButton.svelte';

	type Props = {
		code: string;
		htmlLight: string;
		htmlDark?: string | undefined;
		label?: string;
		lineNumbers?: boolean;
		compact?: boolean;
		framed?: boolean;
		class?: string;
	};

	let {
		code,
		htmlLight,
		htmlDark,
		label = 'Code example',
		lineNumbers = true,
		compact = false,
		framed = true,
		class: className
	}: Props = $props();
</script>

<div
	class={cn(
		'code-block group/code-block relative overflow-hidden bg-card dark:bg-card/44',
		framed && 'rounded-lg shadow-lg dark:inset-shadow-[0_1px_rgb(255_255_255/0.15)]',
		lineNumbers && 'with-line-numbers',
		compact && 'compact',
		className
	)}
	role="region"
	aria-label={label}
>
	<CopyCodeButton
		value={code}
		label={compact ? 'Copy install command to clipboard' : 'Copy code to clipboard'}
		class="absolute inset-e-2 top-2 z-10"
	/>

	<div class="shiki-theme-light">
		<ScrollArea
			orientation="horizontal"
			class="w-full min-w-0"
			viewportTabindex={0}
			viewportAriaLabel={`${label} scroll area`}
			scrollbarXClasses="z-20"
		>
			<!-- eslint-disable-next-line svelte/no-at-html-tags -->
			{@html htmlLight}
		</ScrollArea>
	</div>
	<div class="shiki-theme-dark">
		<ScrollArea
			orientation="horizontal"
			class="w-full min-w-0"
			viewportTabindex={0}
			viewportAriaLabel={`${label} scroll area`}
			scrollbarXClasses="z-20"
		>
			<!-- eslint-disable-next-line svelte/no-at-html-tags -->
			{@html htmlDark ?? htmlLight}
		</ScrollArea>
	</div>
</div>

<style>
	.shiki-theme-dark {
		display: none;
	}

	:global(.dark) .shiki-theme-light {
		display: none;
	}

	:global(.dark) .shiki-theme-dark {
		display: block;
	}

	.code-block :global(.shiki) {
		margin: 0;
		overflow: visible;
		padding: 1rem;
		background-color: transparent !important;
		font-family:
			ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
			monospace;
		font-size: 0.8125rem;
		line-height: 1.5rem;
	}

	.compact :global(.shiki) {
		padding: 0.75rem;
	}

	.code-block :global(.shiki code) {
		display: block;
		width: max-content;
		min-width: 100%;
	}

	.with-line-numbers :global(.shiki code) {
		counter-reset: line;
	}

	.with-line-numbers :global(.shiki .line) {
		counter-increment: line;
	}

	.with-line-numbers :global(.shiki .line::before) {
		display: inline-block;
		width: 1rem;
		margin-inline-end: 1rem;
		color: currentColor;
		text-align: end;
		content: counter(line);
		opacity: 0.25;
		user-select: none;
	}
</style>
