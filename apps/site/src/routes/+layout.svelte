<script lang="ts">
	import { MediaQuery } from 'svelte/reactivity';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import './layout.css';

	let { children } = $props();
	const supportsTooltips = new MediaQuery(
		'(min-width: 768px) and (hover: hover) and (pointer: fine)'
	);
</script>

<Tooltip.Provider delayDuration={350} skipDelayDuration={100} disabled={!supportsTooltips.current}>
	{@render children()}
</Tooltip.Provider>
