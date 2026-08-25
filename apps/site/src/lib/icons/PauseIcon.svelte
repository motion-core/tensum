<script lang="ts">
	import IconRoot from './IconRoot.svelte';
	import type { IconProps } from './types';

	let { strokeWidth = 2, ...props }: IconProps = $props();
</script>

<IconRoot {...props}>
	<rect
		x="2.75"
		y="2.75"
		width="3.5"
		height="12.5"
		rx="1"
		ry="1"
		fill="none"
		stroke="currentColor"
		stroke-linecap="round"
		stroke-linejoin="round"
		stroke-width={strokeWidth}
	/>
	<rect
		x="11.75"
		y="2.75"
		width="3.5"
		height="12.5"
		rx="1"
		ry="1"
		fill="none"
		stroke="currentColor"
		stroke-linecap="round"
		stroke-linejoin="round"
		stroke-width={strokeWidth}
		data-color="color-2"
	/>
</IconRoot>
