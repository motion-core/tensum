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

<Card.Root size="sm" class="h-full min-h-0 bg-zinc-950 text-white ring-white/10">
	<Card.Header>
		<Card.Title>Stage</Card.Title>
		<Card.Description class="text-zinc-400">
			One CSS pixel represents one solver unit.
		</Card.Description>
		<Card.Action>
			<div class="flex items-center gap-1">
				<Button
					variant="ghost"
					size="icon"
					class="text-zinc-300 hover:bg-white/10 hover:text-white"
					aria-label="Scroll stage toward start"
					onclick={() => scrollStage(-1)}>←</Button
				>
				<Button
					variant="ghost"
					size="icon"
					class="text-zinc-300 hover:bg-white/10 hover:text-white"
					aria-label="Scroll stage toward end"
					onclick={() => scrollStage(1)}>→</Button
				>
				<Badge variant="outline" class="border-white/15 bg-white/5 text-zinc-200">
					{status}
				</Badge>
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
				<div class="absolute inset-x-8 top-1/2 h-px bg-white/15"></div>
				<div class="inset-block-0 absolute w-px bg-amber-300/70" style:left={`${targetOffset}px`}>
					<span class="absolute top-0 translate-x-2 whitespace-nowrap text-amber-200 tabular-nums">
						target {target.toFixed(0)} px
					</span>
				</div>

				<div
					bind:this={element}
					class="absolute top-1/2 left-8 grid size-10 -translate-y-1/2 place-items-center rounded-md bg-white font-semibold text-zinc-950 shadow-[0_8px_30px_rgba(255,255,255,0.2)] will-change-transform"
				>
					x
				</div>

				{#each rulerMarks as mark (mark)}
					<div class="absolute top-1/2" style:left={`${mark + 32}px`}>
						<div class="h-2 w-px bg-white/25"></div>
						<span class="block -translate-x-1/2 text-zinc-500 tabular-nums">{mark}</span>
					</div>
				{/each}
			</div>
		</div>
	</Card.Content>
</Card.Root>

<p class="sr-only" role="status" aria-live="polite">
	Spring {status}. Target {target.toFixed(0)} pixels.
</p>
