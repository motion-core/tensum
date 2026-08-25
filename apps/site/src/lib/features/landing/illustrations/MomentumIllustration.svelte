<div class="relative flex h-56 items-center justify-center overflow-hidden" aria-hidden="true">
	<div class="w-[84%] max-w-md">
		<div class="relative mt-3 h-25">
			<div class="absolute inset-x-0 top-12 h-px bg-border"></div>
			<div class="absolute inset-x-0 top-12 h-px overflow-hidden">
				<div class="handoff-progress h-full origin-left bg-emerald-500/55"></div>
			</div>

			<div class="old-target absolute inset-s-[42%] top-0 -translate-x-1/2 text-center">
				<p class="font-mono text-[0.5rem] tracking-[0.12em] text-sky-400 uppercase">previous</p>
				<p class="mt-0.5 font-mono text-[0.625rem] text-sky-300">240 px</p>
				<span
					class="absolute inset-s-1/2 top-8 h-8 -translate-x-1/2 border-s border-dashed border-sky-500/55"
				></span>
			</div>

			<div class="new-target absolute inset-s-[82%] top-0 -translate-x-1/2 text-center">
				<p class="font-mono text-[0.5rem] tracking-[0.12em] text-emerald-400 uppercase">next</p>
				<p class="mt-0.5 font-mono text-[0.625rem] text-emerald-300">480 px</p>
				<span class="absolute inset-s-1/2 top-8 h-8 -translate-x-1/2 border-s border-emerald-500/60"
				></span>
			</div>

			<div
				class="retarget-event absolute inset-s-[30%] top-[4.15rem] -translate-x-1/2 font-mono text-[0.5rem] tracking-[0.12em] text-violet-400 uppercase"
			>
				retarget
			</div>

			<div class="spring-body absolute inset-s-[30%] top-12 z-10 -translate-x-1/2 -translate-y-1/2">
				<span
					class="block size-3 rounded-full border-2 border-background bg-foreground shadow-[0_0_0_1px_var(--border)]"
				></span>
				<div
					class="absolute inset-s-4 top-1/2 flex -translate-y-1/2 items-center whitespace-nowrap"
				>
					<span class="relative h-px w-5 bg-emerald-400">
						<span
							class="absolute inset-e-0 top-1/2 size-1.5 -translate-y-1/2 rotate-45 border-e border-t border-emerald-400"
						></span>
					</span>
					<span class="ms-2 font-mono text-[0.5rem] text-emerald-400">+612 px/s</span>
				</div>
			</div>
		</div>

		<div class="grid grid-cols-3 overflow-hidden rounded-lg border border-border bg-card shadow-sm">
			<div class="border-e border-border px-2.5 py-2">
				<p class="font-mono text-[0.5rem] tracking-widest text-muted-foreground uppercase">
					target
				</p>
				<div class="relative mt-0.5 h-4 font-mono text-[0.625rem]">
					<span class="target-value-old absolute inset-0 text-sky-400">240 px</span>
					<span class="target-value-new absolute inset-0 text-emerald-400">480 px</span>
				</div>
			</div>
			<div class="border-e border-border px-2.5 py-2">
				<p class="font-mono text-[0.5rem] tracking-widest text-muted-foreground uppercase">
					handoff
				</p>
				<p class="mt-0.5 font-mono text-[0.625rem]">position + velocity</p>
			</div>
			<div class="px-2.5 py-2">
				<p class="font-mono text-[0.5rem] tracking-widest text-muted-foreground uppercase">
					result
				</p>
				<p class="mt-0.5 font-mono text-[0.625rem] text-emerald-400">no restart</p>
			</div>
		</div>
	</div>
</div>

<style>
	@keyframes spring-body {
		0% {
			inset-inline-start: 8%;
			opacity: 0;
		}
		5% {
			opacity: 1;
		}
		30% {
			inset-inline-start: 30%;
		}
		62% {
			inset-inline-start: 82%;
		}
		72% {
			inset-inline-start: 87%;
		}
		82% {
			inset-inline-start: 80.5%;
		}
		90% {
			inset-inline-start: 82%;
			opacity: 1;
		}
		100% {
			inset-inline-start: 82%;
			opacity: 0;
		}
	}

	@keyframes handoff-progress {
		0% {
			transform: scaleX(0.08);
			opacity: 0;
		}
		5% {
			opacity: 1;
		}
		62% {
			transform: scaleX(0.82);
		}
		90% {
			transform: scaleX(0.82);
			opacity: 1;
		}
		100% {
			transform: scaleX(0.82);
			opacity: 0;
		}
	}

	@keyframes previous-target {
		0%,
		27% {
			opacity: 1;
		}
		34%,
		100% {
			opacity: 0.28;
		}
	}

	@keyframes next-target {
		0%,
		27% {
			opacity: 0.28;
		}
		34%,
		94% {
			opacity: 1;
		}
		100% {
			opacity: 0.28;
		}
	}

	@keyframes retarget-event {
		0%,
		25% {
			opacity: 0;
			transform: translateX(-50%) translateY(0.25rem);
		}
		30%,
		40% {
			opacity: 1;
			transform: translateX(-50%) translateY(0);
		}
		48%,
		100% {
			opacity: 0;
			transform: translateX(-50%) translateY(-0.25rem);
		}
	}

	@keyframes target-value-old {
		0%,
		27% {
			opacity: 1;
			transform: translateY(0);
		}
		34%,
		100% {
			opacity: 0;
			transform: translateY(-0.25rem);
		}
	}

	@keyframes target-value-new {
		0%,
		27% {
			opacity: 0;
			transform: translateY(0.25rem);
		}
		34%,
		100% {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.old-target {
		opacity: 0.28;
	}

	.handoff-progress {
		transform: scaleX(0.3);
	}

	.target-value-old {
		opacity: 0;
	}

	@media (prefers-reduced-motion: no-preference) {
		.spring-body {
			animation: spring-body 5.2s linear infinite;
		}

		.handoff-progress {
			animation: handoff-progress 5.2s linear infinite;
		}

		.old-target {
			animation: previous-target 5.2s ease-out infinite;
		}

		.new-target {
			animation: next-target 5.2s ease-out infinite;
		}

		.retarget-event {
			animation: retarget-event 5.2s ease-out infinite;
		}

		.target-value-old {
			animation: target-value-old 5.2s ease-out infinite;
		}

		.target-value-new {
			animation: target-value-new 5.2s ease-out infinite;
		}
	}
</style>
