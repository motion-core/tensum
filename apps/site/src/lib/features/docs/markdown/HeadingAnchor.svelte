<script lang="ts">
	import { onDestroy } from 'svelte';
	import { ActionTooltip } from '$lib/components/action-tooltip';
	import { CopyFeedbackIcon } from '$lib/components/copy-feedback';
	import { buttonVariants } from '$lib/components/ui/button';
	import { LinkIcon } from '$lib/icons';
	import { cn } from '$lib/utils';

	let { id }: { id?: string } = $props();

	let copied = $state(false);
	let failed = $state(false);
	let announcement = $state('');
	let resetTimer: ReturnType<typeof setTimeout> | undefined;
	let tooltipLabel = $derived(
		failed
			? 'Could not copy the section link'
			: copied
				? 'Section link copied'
				: 'Copy link to this section'
	);

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
				failed = false;
				announcement = '';
			}, 3000);
		} catch {
			copied = false;
			failed = true;
			announcement = 'Could not copy the section link.';
			clearTimeout(resetTimer);
			resetTimer = setTimeout(() => {
				failed = false;
				announcement = '';
			}, 3000);
		}
	}

	onDestroy(() => clearTimeout(resetTimer));
</script>

{#if id}
	<ActionTooltip content={tooltipLabel} disableCloseOnTriggerClick>
		{#snippet trigger({ props })}
			<button
				{...props}
				type="button"
				class={cn(
					buttonVariants({ variant: 'ghost', size: 'icon-sm' }),
					'ms-1 align-middle text-muted-foreground opacity-0 transition-[opacity,color,background-color,box-shadow] duration-150 group-hover/heading:opacity-100 hover:text-foreground focus-visible:opacity-100 motion-reduce:transition-none'
				)}
				data-copied={copied}
				aria-label={tooltipLabel}
				onclick={copyLink}
			>
				<CopyFeedbackIcon {copied} idleIcon={LinkIcon} />
			</button>
		{/snippet}
	</ActionTooltip>
	<span class="sr-only" role="status" aria-atomic="true">{announcement}</span>
{/if}
