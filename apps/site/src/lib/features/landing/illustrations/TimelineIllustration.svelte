<div class="relative flex h-56 items-center justify-center overflow-hidden p-3" aria-hidden="true">
	<div
		class="w-full overflow-hidden rounded-lg border border-border bg-muted shadow-sm dark:bg-muted/50"
	>
		<div
			class="flex h-8 items-center justify-between border-b border-border px-2.5 text-[0.625rem]"
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

			<div class="grid grid-cols-[3.25rem_1fr] border-b border-border">
				<span
					class="flex h-10 items-center border-e border-border px-2 font-mono text-[0.5625rem] text-muted-foreground"
					>card</span
				>
				<div class="relative h-10">
					<div
						class="absolute inset-y-2 inset-s-[5%] flex w-[34%] items-center rounded-md border border-sky-500/40 bg-sky-500/10 px-2 font-mono text-[0.5625rem] text-sky-400"
					>
						x 320
					</div>
				</div>
			</div>

			<div class="grid grid-cols-[3.25rem_1fr] border-b border-border">
				<span
					class="flex h-10 items-center border-e border-border px-2 font-mono text-[0.5625rem] text-muted-foreground"
					>detail</span
				>
				<div class="relative h-10">
					<div
						class="absolute inset-y-2 inset-s-[32%] flex w-[43%] items-center justify-between rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 font-mono text-[0.5625rem] text-emerald-400"
					>
						<span>rotate 18°</span><span class="text-emerald-400/60">1.14s</span>
					</div>
				</div>
			</div>

			<div class="grid grid-cols-[3.25rem_1fr]">
				<span
					class="flex h-10 items-center border-e border-border px-2 font-mono text-[0.5625rem] text-muted-foreground"
					>items</span
				>
				<div class="relative h-10">
					<div
						class="absolute inset-y-2 inset-s-[63%] flex w-[30%] items-center rounded-md border border-violet-500/40 bg-violet-500/10 px-2 font-mono text-[0.5625rem] text-violet-400"
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
			animation: timeline-cursor 5s linear infinite;
		}
	}
</style>
