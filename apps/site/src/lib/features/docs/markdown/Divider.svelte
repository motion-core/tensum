<script lang="ts">
	import { cn } from '$lib/utils';

	type Props = Record<string, unknown> & { class?: string };
	let { class: className, ...restProps }: Props = $props();
</script>

<hr {...restProps} class={cn('my-14 border-0 border-t border-border', className)} />
