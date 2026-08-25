<script lang="ts">
	import type { LayoutProps } from './$types';
	import DocsShell from '$lib/features/docs/DocsShell.svelte';

	let { children }: LayoutProps = $props();
</script>

<DocsShell>
	{@render children()}
</DocsShell>
