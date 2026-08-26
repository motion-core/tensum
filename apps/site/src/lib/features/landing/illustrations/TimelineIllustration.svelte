<script lang="ts">
	let { paused = false }: { paused?: boolean } = $props();
</script>

<div
	class="timeline-illustration relative mx-auto flex h-56 sm:max-w-[85%] items-center justify-center overflow-hidden p-6"
	data-paused={paused}
	aria-hidden="true"
>
	<div
		class="w-full overflow-hidden rounded-lg bg-background shadow-[0px_0px_0px_1px_rgba(0,0,0,0.04),0_1px_1px_rgba(0,0,0,0.05),0_2px_2px_rgba(0,0,0,0.05),0_2px_4px_rgba(0,0,0,0.05)] dark:bg-card/64 dark:inset-shadow-[0_1px_rgb(255_255_255/0.15)]"
	>
		<div
			class="flex h-8 items-center justify-between border-b border-border/64 px-2.5 text-[0.625rem] dark:border-card/80"
		>
			<span class="font-medium">timeline.motionSpring()</span>
			<span class="font-mono text-muted-foreground">2.48 s</span>
		</div>

		<div class="relative">
			<div class="pointer-events-none absolute inset-y-0 inset-s-13 inset-e-0 z-20">
				<div class="timeline-cursor absolute inset-y-0 inset-s-0 w-px bg-foreground/70">
					<span
						class="absolute inset-s-1/2 top-0 size-1.5 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-foreground"
					></span>
				</div>
			</div>

			<div class="grid grid-cols-[3.25rem_1fr] border-b border-border/64 dark:border-card/80">
				<span
					class="flex h-10 items-center border-e border-border/64 px-2 font-mono text-[0.5625rem] text-muted-foreground dark:border-card/80"
					>card</span
				>
				<div class="relative h-10">
					<div
						class="absolute inset-y-2 inset-s-[5%] flex w-[34%] items-center rounded-md border border-chart-1/40 bg-chart-1/10 px-2 font-mono text-[0.5625rem] text-chart-1"
					>
						x 320
					</div>
				</div>
			</div>

			<div class="grid grid-cols-[3.25rem_1fr] border-b border-border/64 dark:border-card/80">
				<span
					class="flex h-10 items-center border-e border-border/64 px-2 font-mono text-[0.5625rem] text-muted-foreground dark:border-card/80"
					>detail</span
				>
				<div class="relative h-10">
					<div
						class="absolute inset-y-2 inset-s-[32%] flex w-[43%] items-center justify-between rounded-md border border-chart-6/40 bg-chart-6/10 px-2 font-mono text-[0.5625rem] text-chart-6"
					>
						<span>rotate 18°</span><span class="text-chart-6/60">1.14s</span>
					</div>
				</div>
			</div>

			<div class="grid grid-cols-[3.25rem_1fr]">
				<span
					class="flex h-10 items-center border-e border-border/64 px-2 font-mono text-[0.5625rem] text-muted-foreground dark:border-card/80"
					>items</span
				>
				<div class="relative h-10">
					<div
						class="absolute inset-y-2 inset-s-[60%] flex w-[35%] items-center rounded-md border border-chart-4/40 bg-chart-4/10 px-2 font-mono text-[0.5625rem] text-chart-4"
					>
						stagger × 6
					</div>
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	@keyframes timeline-cursor {
		from {
			inset-inline-start: 0;
		}
		to {
			inset-inline-start: calc(100% - 1px);
		}
	}

	@media (prefers-reduced-motion: no-preference) {
		.timeline-cursor {
			animation: timeline-cursor 5s cubic-bezier(0.65, 0, 0.35, 1) infinite;
		}
	}

	.timeline-illustration[data-paused='true'] .timeline-cursor {
		animation-play-state: paused;
	}
</style>
