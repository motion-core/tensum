<script lang="ts">
	import { cn } from '$lib/utils';
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
		'code-block group/code-block relative overflow-hidden bg-card',
		framed && 'rounded-lg border border-border shadow-sm',
		lineNumbers && 'with-line-numbers',
		compact && 'compact',
		className
	)}
	role="region"
	aria-label={label}
>
	<CopyCodeButton
		value={code}
		label={`Copy ${label.toLowerCase()}`}
		class="absolute inset-e-1 top-1 z-10 bg-card/80 backdrop-blur-sm"
	/>

	<div class="shiki-theme-light">
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html htmlLight}
	</div>
	<div class="shiki-theme-dark">
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html htmlDark ?? htmlLight}
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
		overflow-x: auto;
		padding: 0.5rem;
		background-color: var(--card) !important;
		font-family:
			ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
			monospace;
		font-size: 0.75rem;
		line-height: 1.25rem;
	}

	.compact :global(.shiki) {
		padding: 0.5rem;
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
