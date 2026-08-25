<script lang="ts">
	let { children }: { children: import('svelte').Snippet } = $props();
</script>

<div class="mt-5 overflow-x-auto rounded-lg border border-border bg-card px-4 py-3">
	<code class="font-mono text-sm leading-relaxed whitespace-pre text-foreground">
		{@render children()}
	</code>
</div>
