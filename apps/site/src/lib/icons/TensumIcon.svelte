<script lang="ts">
	import IconRoot from './IconRoot.svelte';
	import type { IconProps } from './types';

	let { ...props }: IconProps = $props();
</script>

<IconRoot {...props} viewBox="0 0 12 11">
	<rect
		width="6.53183"
		height="6.53183"
		rx="1"
		transform="matrix(0.866044 -0.499967 0.866044 0.499967 0 7.26562)"
		fill="currentColor"
		fill-opacity="0.2"
	/>
	<rect
		width="6.53183"
		height="6.53183"
		rx="1"
		transform="matrix(0.866044 -0.499967 0.866044 0.499967 0 3.26562)"
		fill="currentColor"
		fill-opacity="0.4"
	/>
	<rect
		width="6.53183"
		height="6.53183"
		rx="1"
		transform="matrix(0.866044 -0.499967 0.866044 0.499967 0 5.26562)"
		fill="currentColor"
		fill-opacity="0.3"
	/>
</IconRoot>
