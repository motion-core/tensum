<script lang="ts">
	import type { Snippet } from 'svelte';
	import { ScrollArea } from '$lib/components/ui/scroll-area';
	import { cn } from '$lib/utils';

	type Props = Record<string, unknown> & {
		class?: string;
		children?: Snippet;
	};

	let { children, class: className, ...restProps }: Props = $props();
</script>

<div
	class="my-8 overflow-hidden rounded-xl bg-card shadow-lg dark:bg-card/44 dark:inset-shadow-[0_1px_rgb(255_255_255/0.15)]"
>
	<ScrollArea
		orientation="horizontal"
		class="w-full min-w-0"
		viewportTabindex={0}
		viewportAriaLabel="Documentation table scroll area"
	>
		<table {...restProps} class={cn('w-full min-w-xl border-collapse text-sm', className)}>
			{@render children?.()}
		</table>
	</ScrollArea>
</div>
