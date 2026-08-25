<script lang="ts">
	import { ScrollArea } from '$lib/components/ui/scroll-area';

	let { children }: { children: import('svelte').Snippet } = $props();
</script>

<div class="mt-5 overflow-hidden rounded-lg bg-card shadow-sm">
	<ScrollArea
		orientation="horizontal"
		class="w-full min-w-0"
		viewportTabindex={0}
		viewportAriaLabel="API signature scroll area"
	>
		<code
			class="block w-max min-w-full p-2 font-mono text-xs leading-relaxed whitespace-pre text-foreground"
		>
			{@render children()}
		</code>
	</ScrollArea>
</div>
