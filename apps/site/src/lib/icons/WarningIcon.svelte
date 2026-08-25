<script lang="ts">
	import IconRoot from './IconRoot.svelte';
	import type { IconProps } from './types';

	let { strokeWidth = 1.5, ...props }: IconProps = $props();
</script>

<IconRoot {...props}>
	<path
		d="m7.638 3.49-5.425 9.4a1.574 1.574 0 0 0 1.362 2.36h10.85a1.574 1.574 0 0 0 1.362-2.36l-5.425-9.4a1.574 1.574 0 0 0-2.724 0Z"
		stroke="currentColor"
		stroke-linecap="round"
		stroke-linejoin="round"
		stroke-width={strokeWidth}
	/>
	<path d="M9 6.75v3" stroke="currentColor" stroke-linecap="round" stroke-width={strokeWidth} />
	<circle cx="9" cy="12.5" r="1" fill="currentColor" />
</IconRoot>
