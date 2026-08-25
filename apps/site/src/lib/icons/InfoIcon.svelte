<script lang="ts">
	import IconRoot from './IconRoot.svelte';
	import type { IconProps } from './types';

	let { strokeWidth = 1.5, ...props }: IconProps = $props();
</script>

<IconRoot {...props}>
	<path
		d="M9 16.25A7.25 7.25 0 1 0 9 1.75a7.25 7.25 0 0 0 0 14.5Z"
		stroke="currentColor"
		stroke-linecap="round"
		stroke-linejoin="round"
		stroke-width={strokeWidth}
	/>
	<path
		d="M9 12.75v-3.5a.5.5 0 0 0-.5-.5h-.75"
		stroke="currentColor"
		stroke-linecap="round"
		stroke-linejoin="round"
		stroke-width={strokeWidth}
	/>
	<circle cx="9" cy="5.75" r="1" fill="currentColor" />
</IconRoot>
