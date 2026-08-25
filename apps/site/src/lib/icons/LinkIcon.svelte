<script lang="ts">
	import IconRoot from './IconRoot.svelte';
	import type { IconProps } from './types';

	let { strokeWidth = 1.5, ...props }: IconProps = $props();
</script>

<IconRoot {...props}>
	<path
		d="M8.369 6.893a3.5 3.5 0 0 0-.841.624l-.01.01a3.536 3.536 0 0 0 0 5l2.175 2.175a3.536 3.536 0 0 0 5 0l.01-.01a3.536 3.536 0 0 0 0-5l-.762-.762"
		stroke="currentColor"
		stroke-linecap="round"
		stroke-linejoin="round"
		stroke-width={strokeWidth}
	/>
	<path
		d="M9.633 11.107c.302-.161.586-.369.841-.624l.01-.01a3.536 3.536 0 0 0 0-5L8.309 3.298a3.536 3.536 0 0 0-5 0l-.01.01a3.536 3.536 0 0 0 0 5l.762.762"
		stroke="currentColor"
		stroke-linecap="round"
		stroke-linejoin="round"
		stroke-width={strokeWidth}
	/>
</IconRoot>
