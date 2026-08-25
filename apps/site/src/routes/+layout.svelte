<script lang="ts">
	import * as Tooltip from '$lib/components/ui/tooltip';
	import './layout.css';

	let { children } = $props();
</script>

<Tooltip.Provider delayDuration={350} skipDelayDuration={100}>
	{@render children()}
</Tooltip.Provider>
