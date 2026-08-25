<script lang="ts">
	import { onDestroy } from 'svelte';
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
	let announcement = $state('');
	let resetTimer: ReturnType<typeof setTimeout> | undefined;

	async function copy() {
		try {
			await navigator.clipboard.writeText(value);
			copied = true;
			announcement = successMessage;
			clearTimeout(resetTimer);
			resetTimer = setTimeout(() => {
				copied = false;
				announcement = '';
			}, 2000);
		} catch {
			announcement = failureMessage;
		}
	}

	onDestroy(() => clearTimeout(resetTimer));
</script>

<Button
	type="button"
	variant="ghost"
	{size}
	class={className}
	data-copied={copied}
	aria-label={copied ? copiedLabel : label}
	onclick={copy}
>
	<CopyFeedbackIcon {copied} idleIcon={CopyIcon} />
</Button>
<span class="sr-only" role="status" aria-live="polite">{announcement}</span>
