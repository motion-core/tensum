<div
	class="momentum-illustration relative flex h-56 items-center justify-center overflow-hidden p-3"
	aria-hidden="true"
>
	<div>
		<div class="relative mt-3 h-25">
			<div class="absolute inset-x-0 top-12 h-px bg-border"></div>
			<div
				class="spring-trail absolute inset-s-[82%] top-12 h-px w-12 -translate-x-full -translate-y-1/2 bg-linear-to-r from-transparent to-chart-6/70"
			></div>

			<div class="old-target absolute inset-s-[42%] top-0 -translate-x-1/2 text-center">
				<p class="font-mono text-[0.5rem] tracking-[0.12em] text-chart-1 uppercase">previous</p>
				<p class="mt-0.5 font-mono text-[0.625rem] text-chart-1/80">240 px</p>
				<span
					class="absolute inset-s-1/2 top-8 h-8 -translate-x-1/2 border-s border-dashed border-chart-1/55"
				></span>
			</div>

			<div class="new-target absolute inset-s-[82%] top-0 -translate-x-1/2 text-center">
				<p class="font-mono text-[0.5rem] tracking-[0.12em] text-chart-6 uppercase">next</p>
				<p class="mt-0.5 font-mono text-[0.625rem] text-chart-6/80">480 px</p>
				<span class="absolute inset-s-1/2 top-8 h-8 -translate-x-1/2 border-s border-chart-6/60"
				></span>
			</div>

			<div
				class="retarget-event absolute inset-s-[35%] top-[4.15rem] -translate-x-1/2 font-mono text-[0.5rem] tracking-[0.12em] text-chart-4 uppercase"
			>
				retarget
			</div>

			<div class="spring-body absolute inset-s-[82%] top-12 z-10 -translate-x-1/2 -translate-y-1/2">
				<span
					class="block size-3 rounded-full border-2 border-background bg-foreground shadow-[0_0_0_1px_var(--border)]"
				></span>
				<div
					class="absolute inset-s-4 top-1/2 flex -translate-y-1/2 items-center whitespace-nowrap"
				>
					<span class="relative h-px w-5 bg-chart-6">
						<span
							class="absolute inset-e-0 top-1/2 size-1.5 -translate-y-1/2 rotate-45 border-e border-t border-chart-6"
						></span>
					</span>
					<span class="ms-2 font-mono text-[0.5rem] text-chart-6">+612 px/s</span>
				</div>
			</div>
		</div>

		<div class="grid grid-cols-3 overflow-hidden rounded-lg bg-muted shadow-sm dark:bg-muted/50">
			<div class="border-e border-border px-2.5 py-2">
				<p class="font-mono text-[0.5rem] tracking-widest text-muted-foreground uppercase">
					target
				</p>
				<div class="relative mt-0.5 h-4 font-mono text-[0.625rem]">
					<span class="target-value-old absolute inset-0 text-chart-1">240 px</span>
					<span class="target-value-new absolute inset-0 text-chart-6">480 px</span>
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
				<p class="mt-0.5 font-mono text-[0.625rem] text-chart-6">no restart</p>
			</div>
		</div>
	</div>
</div>

<style>
	.momentum-illustration {
		--momentum-duration: 4.2s;
	}

	/* Sampled from two analytical springs with continuous position and velocity at 19.31%. */
	@keyframes spring-body {
		0% {
			inset-inline-start: 8%;
			opacity: 0;
		}
		5% {
			inset-inline-start: 8%;
			opacity: 1;
		}
		7.86% {
			inset-inline-start: 10.46%;
		}
		10.72% {
			inset-inline-start: 16.07%;
		}
		13.59% {
			inset-inline-start: 22.74%;
		}
		16.45% {
			inset-inline-start: 29.15%;
		}
		19.31% {
			inset-inline-start: 34.55%;
		}
		22.17% {
			inset-inline-start: 44.69%;
		}
		25.03% {
			inset-inline-start: 60.66%;
		}
		27.9% {
			inset-inline-start: 76.28%;
		}
		30.76% {
			inset-inline-start: 87.69%;
		}
		33.62% {
			inset-inline-start: 93.52%;
		}
		36.48% {
			inset-inline-start: 94.31%;
		}
		39.34% {
			inset-inline-start: 91.67%;
		}
		42.21% {
			inset-inline-start: 87.53%;
		}
		45.07% {
			inset-inline-start: 83.48%;
		}
		47.93% {
			inset-inline-start: 80.52%;
		}
		50.79% {
			inset-inline-start: 79.01%;
		}
		53.66% {
			inset-inline-start: 78.81%;
		}
		56.52% {
			inset-inline-start: 79.49%;
		}
		59.38% {
			inset-inline-start: 80.57%;
		}
		62.24% {
			inset-inline-start: 81.62%;
		}
		65.1% {
			inset-inline-start: 82.39%;
		}
		67.97% {
			inset-inline-start: 82.78%;
		}
		70.83% {
			inset-inline-start: 82.83%;
		}
		73.69% {
			inset-inline-start: 82.65%;
		}
		76.55% {
			inset-inline-start: 82.37%;
		}
		79.41% {
			inset-inline-start: 82.1%;
		}
		82.28% {
			inset-inline-start: 81.9%;
		}
		85.14% {
			inset-inline-start: 81.8%;
		}
		88%,
		92% {
			inset-inline-start: 82%;
			opacity: 1;
		}
		100% {
			inset-inline-start: 82%;
			opacity: 0;
		}
	}

	@keyframes previous-target {
		0%,
		17% {
			opacity: 1;
		}
		24%,
		100% {
			opacity: 0.28;
		}
	}

	@keyframes next-target {
		0%,
		17% {
			opacity: 0.28;
		}
		24%,
		94% {
			opacity: 1;
		}
		100% {
			opacity: 0.28;
		}
	}

	@keyframes retarget-event {
		0%,
		16% {
			opacity: 0;
			transform: translateX(-50%) translateY(0.25rem);
		}
		20%,
		30% {
			opacity: 1;
			transform: translateX(-50%) translateY(0);
		}
		38%,
		100% {
			opacity: 0;
			transform: translateX(-50%) translateY(-0.25rem);
		}
	}

	@keyframes target-value-old {
		0%,
		17% {
			opacity: 1;
			transform: translateY(0);
		}
		24%,
		100% {
			opacity: 0;
			transform: translateY(-0.25rem);
		}
	}

	@keyframes target-value-new {
		0%,
		17% {
			opacity: 0;
			transform: translateY(0.25rem);
		}
		24%,
		100% {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.old-target {
		opacity: 0.28;
	}

	.spring-trail,
	.retarget-event {
		opacity: 0;
	}

	.target-value-old {
		opacity: 0;
	}

	@media (prefers-reduced-motion: no-preference) {
		.spring-body,
		.spring-trail {
			animation: spring-body var(--momentum-duration) linear infinite;
		}

		.old-target {
			animation: previous-target var(--momentum-duration) cubic-bezier(0.2, 0, 0, 1) infinite;
		}

		.new-target {
			animation: next-target var(--momentum-duration) cubic-bezier(0.2, 0, 0, 1) infinite;
		}

		.retarget-event {
			animation: retarget-event var(--momentum-duration) cubic-bezier(0.16, 1, 0.3, 1) infinite;
		}

		.target-value-old {
			animation: target-value-old var(--momentum-duration) cubic-bezier(0.16, 1, 0.3, 1) infinite;
		}

		.target-value-new {
			animation: target-value-new var(--momentum-duration) cubic-bezier(0.16, 1, 0.3, 1) infinite;
		}
	}
</style>
