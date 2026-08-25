<script lang="ts">
	import { ScrollArea } from '$lib/components/ui/scroll-area';

	let { children }: { children: import('svelte').Snippet } = $props();
</script>

<div
	class="mt-5 overflow-hidden rounded-lg bg-card shadow-lg dark:bg-card/44 dark:inset-shadow-[0_1px_rgb(255_255_255/0.15)]"
>
	<ScrollArea
		orientation="horizontal"
		class="w-full min-w-0"
		viewportTabindex={0}
		viewportAriaLabel="API signature scroll area"
	>
		<code
			class="block w-max min-w-full p-4 font-mono text-sm leading-relaxed whitespace-pre text-foreground"
		>
			{@render children()}
		</code>
	</ScrollArea>
</div>
