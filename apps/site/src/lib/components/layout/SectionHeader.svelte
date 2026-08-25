<script lang="ts">
	import { cn } from '$lib/utils';

	type Props = {
		headingId: string;
		title: string;
		description: string;
		class?: string;
	};

	let { headingId, title, description, class: className }: Props = $props();
</script>

<header class={cn('max-w-xl', className)}>
	<h2
		id={headingId}
		class="font-heading text-2xl font-semibold tracking-tight text-balance sm:text-3xl"
	>
		{title}
	</h2>
	<p class="mt-3 text-sm leading-relaxed text-pretty text-muted-foreground">{description}</p>
</header>
