<script lang="ts">
	import { CheckIcon, type IconComponent } from '$lib/icons';

	type Props = {
		copied: boolean;
		idleIcon: IconComponent;
	};

	let { copied, idleIcon: IdleIcon }: Props = $props();
</script>

<span
	class="relative flex size-4 shrink-0 items-center justify-center leading-none"
	aria-hidden="true"
>
	<span class="icon-state" data-visible={!copied}>
		<IdleIcon size={16} strokeWidth={1.5} />
	</span>
	<span class="icon-state text-emerald-500" data-visible={copied}>
		<CheckIcon size={16} strokeWidth={1.5} />
	</span>
</span>

<style>
	.icon-state {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		transition-property: opacity, scale, filter;
		transition-duration: 180ms;
		transition-timing-function: cubic-bezier(0.2, 0, 0, 1);
	}

	.icon-state[data-visible='true'] {
		scale: 1;
		opacity: 1;
		filter: blur(0);
	}

	.icon-state[data-visible='false'] {
		scale: 0.25;
		opacity: 0;
		filter: blur(4px);
	}

	@media (prefers-reduced-motion: reduce) {
		.icon-state {
			scale: 1;
			filter: none;
			transition-property: opacity;
		}
	}
</style>
