<script lang="ts">
	let { children }: { children: import('svelte').Snippet } = $props();
</script>

<div class="mt-5 overflow-x-auto rounded-lg bg-card p-2 shadow-sm">
	<code class="font-mono text-xs leading-relaxed whitespace-pre text-foreground">
		{@render children()}
	</code>
</div>
