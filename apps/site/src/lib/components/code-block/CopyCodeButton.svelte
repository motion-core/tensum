<script lang="ts">
	import { onDestroy } from 'svelte';
	import { ActionTooltip } from '$lib/components/action-tooltip';
	import { CopyFeedbackIcon } from '$lib/components/copy-feedback';
	import { Button, type ButtonSize } from '$lib/components/ui/button';
	import { CopyIcon } from '$lib/icons';

	type Props = {
		value: string;
		label?: string;
		copiedLabel?: string;
		successMessage?: string;
		failureMessage?: string;
		size?: ButtonSize;
		class?: string;
	};

	let {
		value,
		label = 'Copy code',
		copiedLabel = 'Code copied',
		successMessage = 'Code copied to clipboard.',
		failureMessage = 'Could not copy the code.',
		size = 'icon-md',
		class: className
	}: Props = $props();

	let copied = $state(false);
	let failed = $state(false);
	let announcement = $state('');
	let resetTimer: ReturnType<typeof setTimeout> | undefined;
	let tooltipLabel = $derived(failed ? 'Could not copy code' : copied ? copiedLabel : label);

	async function copy() {
		try {
			await navigator.clipboard.writeText(value);
			copied = true;
			announcement = successMessage;
			clearTimeout(resetTimer);
			resetTimer = setTimeout(() => {
				copied = false;
				failed = false;
				announcement = '';
			}, 3000);
		} catch {
			copied = false;
			failed = true;
			announcement = failureMessage;
			clearTimeout(resetTimer);
			resetTimer = setTimeout(() => {
				failed = false;
				announcement = '';
			}, 3000);
		}
	}

	onDestroy(() => clearTimeout(resetTimer));
</script>

<ActionTooltip content={tooltipLabel} disableCloseOnTriggerClick>
	{#snippet trigger({ props })}
		<Button
			{...props}
			type="button"
			variant="ghost"
			{size}
			class={className}
			data-copied={copied}
			aria-label={tooltipLabel}
			onclick={copy}
		>
			<CopyFeedbackIcon {copied} idleIcon={CopyIcon} />
		</Button>
	{/snippet}
</ActionTooltip>
<span class="sr-only" role="status" aria-atomic="true">{announcement}</span>
