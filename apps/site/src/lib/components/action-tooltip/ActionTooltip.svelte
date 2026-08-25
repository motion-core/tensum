<script lang="ts">
	import type { Snippet } from 'svelte';
	import * as Tooltip from '$lib/components/ui/tooltip';

	type Props = {
		content: string;
		trigger: Snippet<[{ props: Record<string, unknown> }]>;
		side?: 'top' | 'right' | 'bottom' | 'left';
		disableCloseOnTriggerClick?: boolean;
	};

	let { content, trigger, side = 'top', disableCloseOnTriggerClick = false }: Props = $props();
</script>

<Tooltip.Root {disableCloseOnTriggerClick}>
	<Tooltip.Trigger>
		{#snippet child({ props })}
			{@render trigger({ props })}
		{/snippet}
	</Tooltip.Trigger>
	<Tooltip.Content {side} sideOffset={6}>{content}</Tooltip.Content>
</Tooltip.Root>
