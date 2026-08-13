<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import type { AnimationStatus } from './model.js';

	let {
		element = $bindable(null),
		target,
		status
	}: {
		element?: HTMLElement | null;
		target: number;
		status: AnimationStatus;
	} = $props();

	const rulerMarks = [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
	let viewport: HTMLElement;
	let targetOffset = $derived(Math.max(0, Math.min(1000, target)) + 32);

	function scrollStage(direction: -1 | 1): void {
		viewport.scrollBy({ left: direction * 240, behavior: 'smooth' });
	}
</script>

<Card.Root size="sm" class="h-full min-h-0">
	<Card.Header>
		<Card.Title>Stage</Card.Title>
		<Card.Description>One CSS pixel represents one solver unit.</Card.Description>
		<Card.Action>
			<div class="flex items-center gap-1">
				<Button
					variant="ghost"
					size="icon"
					aria-label="Scroll stage toward start"
					onclick={() => scrollStage(-1)}>←</Button
				>
				<Button
					variant="ghost"
					size="icon"
					aria-label="Scroll stage toward end"
					onclick={() => scrollStage(1)}>→</Button
				>
				<Badge variant="outline">{status}</Badge>
			</div>
		</Card.Action>
	</Card.Header>
	<Card.Content class="min-h-0 flex-1 overflow-hidden">
		<div
			bind:this={viewport}
			class="h-full overflow-x-auto"
			role="region"
			aria-label="Spring animation stage"
		>
			<div class="relative h-full min-h-32 w-[1064px] overflow-hidden" aria-hidden="true">
				<div class="absolute inset-x-8 top-1/2 h-px bg-border"></div>
				<div
					class="absolute top-4 h-[calc(50%-1rem)] border-l border-dashed border-primary"
					style:left={`${targetOffset}px`}
				>
					<span class="absolute top-0 translate-x-2 whitespace-nowrap text-primary tabular-nums">
						target {target.toFixed(0)} px
					</span>
				</div>

				<div
					bind:this={element}
					class="absolute bottom-1/2 left-8 mb-1 grid size-10 place-items-center rounded-md bg-primary font-semibold text-primary-foreground shadow-sm will-change-transform"
				>
					x
				</div>

				{#each rulerMarks as mark (mark)}
					<div class="absolute top-1/2" style:left={`${mark + 32}px`}>
						<div class="h-2 w-px bg-border"></div>
						<span class="block -translate-x-1/2 text-muted-foreground tabular-nums">{mark}</span>
					</div>
				{/each}
			</div>
		</div>
	</Card.Content>
</Card.Root>

<p class="sr-only" role="status" aria-live="polite">
	Spring {status}. Target {target.toFixed(0)} pixels.
</p>
