<script lang="ts">
	import { IconTransition } from '$lib/components/icon-transition';
	import { CheckIcon, type IconComponent } from '$lib/icons';

	type Props = {
		copied: boolean;
		idleIcon: IconComponent;
	};

	let { copied, idleIcon }: Props = $props();
</script>

<IconTransition
	active={copied}
	inactiveIcon={idleIcon}
	activeIcon={CheckIcon}
	activeClass="text-emerald-500"
/>
