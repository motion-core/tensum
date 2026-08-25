<script lang="ts">
	import IconRoot from './IconRoot.svelte';
	import type { IconProps } from './types';

	let { strokeWidth = 1.5, ...props }: IconProps = $props();
</script>

<IconRoot {...props}>
	<line
		x1="3.25"
		y1="5"
		x2="14.75"
		y2="5"
		stroke="currentColor"
		stroke-linecap="round"
		stroke-width={strokeWidth}
	/>
	<line
		x1="3.25"
		y1="9"
		x2="14.75"
		y2="9"
		stroke="currentColor"
		stroke-linecap="round"
		stroke-width={strokeWidth}
	/>
	<line
		x1="3.25"
		y1="13"
		x2="14.75"
		y2="13"
		stroke="currentColor"
		stroke-linecap="round"
		stroke-width={strokeWidth}
	/>
</IconRoot>
