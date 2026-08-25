<script lang="ts">
	let { children }: { children: import('svelte').Snippet } = $props();
</script>

<div class="mt-5 overflow-x-auto rounded-lg border border-border bg-card p-2">
	<code class="font-mono text-xs leading-relaxed whitespace-pre text-foreground">
		{@render children()}
	</code>
</div>
