<script lang="ts">
	import IconRoot from './IconRoot.svelte';
	import type { IconProps } from './types';

	let { strokeWidth = 1.5, ...props }: IconProps = $props();
</script>

<IconRoot {...props}>
	<path
		d="M5.245,2.878l9.492,5.256c.685,.379,.685,1.353,0,1.732L5.245,15.122c-.669,.371-1.495-.108-1.495-.866V3.744c0-.758,.825-1.237,1.495-.866Z"
		stroke="currentColor"
		stroke-linecap="round"
		stroke-linejoin="round"
		stroke-width={strokeWidth}
	/>
</IconRoot>
