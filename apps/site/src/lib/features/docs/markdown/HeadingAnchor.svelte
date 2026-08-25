<script lang="ts">
	import { Link06Icon } from '@hugeicons/core-free-icons';
	import { onDestroy } from 'svelte';
	import { CopyFeedbackIcon } from '$lib/components/copy-feedback';

	let { id }: { id?: string } = $props();

	let copied = $state(false);
	let announcement = $state('');
	let resetTimer: ReturnType<typeof setTimeout> | undefined;

	async function copyLink() {
		if (!id) return;

		try {
			const url = new URL(`#${id}`, window.location.href);
			await navigator.clipboard.writeText(url.toString());
			copied = true;
			announcement = 'Section link copied to clipboard.';
			clearTimeout(resetTimer);
			resetTimer = setTimeout(() => {
				copied = false;
				announcement = '';
			}, 2000);
		} catch {
			announcement = 'Could not copy the section link.';
		}
	}

	onDestroy(() => clearTimeout(resetTimer));
</script>

{#if id}
	<a
		href={`#${id}`}
		class="ms-1 inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-[opacity,color,background-color] duration-150 outline-none group-hover/heading:opacity-100 hover:bg-card hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/40 motion-reduce:transition-none"
		data-copied={copied}
		aria-label={copied ? 'Section link copied' : 'Copy link to this section'}
		onclick={copyLink}
	>
		<CopyFeedbackIcon {copied} idleIcon={Link06Icon} />
	</a>
	<span class="sr-only" role="status" aria-live="polite">{announcement}</span>
{/if}
