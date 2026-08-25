<div class="relative flex h-64 items-center justify-center overflow-hidden p-3" aria-hidden="true">
	<div class="relative h-48 w-[90%] max-w-xl">
		<div
			class="absolute inset-s-1/2 top-0 z-10 flex h-13 w-32 -translate-x-1/2 items-start justify-between rounded-lg border border-border bg-muted/50 p-2.5 shadow-sm"
		>
			<div>
				<p class="font-mono text-[0.5625rem] text-muted-foreground">analytical core</p>
				<p class="mt-0.5 text-xs font-medium">state(t)</p>
			</div>
			<span class="size-1.5 rounded-full bg-emerald-500"></span>
		</div>

		<svg
			class="pointer-events-none absolute inset-0 size-full"
			viewBox="0 0 600 192"
			preserveAspectRatio="none"
		>
			<path class="connector-base" d="M280 52 V68 Q280 76 272 76 H98 Q90 76 90 84 V104" />
			<path class="connector-base" d="M300 52 V104" />
			<path class="connector-base" d="M320 52 V68 Q320 76 328 76 H502 Q510 76 510 84 V104" />
			<defs>
				<linearGradient
					id="output-flow-left"
					x1="260.7"
					y1="57.3"
					x2="299.3"
					y2="46.7"
					gradientUnits="userSpaceOnUse"
					gradientTransform="translate(-209.3 57.3)"
				>
					<animateTransform
						attributeName="gradientTransform"
						type="translate"
						values="0 0;-209.3 57.3"
						begin="0s"
						dur="2.4s"
						keySplines="0.16 1 0.3 1"
						repeatCount="indefinite"
					/>
					<stop offset="0" stop-color="var(--foreground)" stop-opacity="0" />
					<stop offset="0.2" stop-color="var(--foreground)" stop-opacity="0.95" />
					<stop offset="0.55" stop-color="var(--foreground)" stop-opacity="0.95" />
					<stop offset="1" stop-color="var(--foreground)" stop-opacity="0" />
				</linearGradient>

				<linearGradient
					id="output-flow-center"
					x1="300"
					y1="77"
					x2="300"
					y2="27"
					gradientUnits="userSpaceOnUse"
					gradientTransform="translate(0 77)"
				>
					<animateTransform
						attributeName="gradientTransform"
						type="translate"
						values="0 0;0 77"
						begin="0s"
						dur="2.4s"
						keySplines="0.16 1 0.3 1"
						repeatCount="indefinite"
					/>
					<stop offset="0" stop-color="var(--foreground)" stop-opacity="0" />
					<stop offset="0.2" stop-color="var(--foreground)" stop-opacity="0.95" />
					<stop offset="0.55" stop-color="var(--foreground)" stop-opacity="0.95" />
					<stop offset="1" stop-color="var(--foreground)" stop-opacity="0" />
				</linearGradient>

				<linearGradient
					id="output-flow-right"
					x1="339.3"
					y1="57.3"
					x2="300.7"
					y2="46.7"
					gradientUnits="userSpaceOnUse"
					gradientTransform="translate(209.3 57.3)"
				>
					<animateTransform
						attributeName="gradientTransform"
						type="translate"
						values="0 0;209.3 57.3"
						begin="0s"
						dur="2.4s"
						keySplines="0.16 1 0.3 1"
						repeatCount="indefinite"
					/>
					<stop offset="0" stop-color="var(--foreground)" stop-opacity="0" />
					<stop offset="0.2" stop-color="var(--foreground)" stop-opacity="0.95" />
					<stop offset="0.55" stop-color="var(--foreground)" stop-opacity="0.95" />
					<stop offset="1" stop-color="var(--foreground)" stop-opacity="0" />
				</linearGradient>
			</defs>
			<g>
				<path
					class="flow-trace"
					d="M280 52 V68 Q280 76 272 76 H98 Q90 76 90 84 V104"
					stroke="url(#output-flow-left)"
				/>
				<path class="flow-trace" d="M300 52 V104" stroke="url(#output-flow-center)" />
				<path
					class="flow-trace"
					d="M320 52 V68 Q320 76 328 76 H502 Q510 76 510 84 V104"
					stroke="url(#output-flow-right)"
				/>
			</g>
		</svg>

		<div
			class="absolute inset-s-0 top-26 z-10 h-19 w-[30%] rounded-lg border border-border bg-muted p-2.5 shadow-sm dark:bg-muted/50"
		>
			<div class="flex items-center justify-between">
				<span class="font-mono text-[0.5625rem] text-muted-foreground">01</span>
				<span class="size-1.5 rounded-full bg-muted-foreground/40"></span>
			</div>
			<p class="mt-3 text-xs font-medium">GSAP plugin</p>
			<p class="mt-0.5 font-mono text-[0.5625rem] text-muted-foreground">timeline clock</p>
		</div>

		<div
			class="absolute inset-s-1/2 top-26 z-10 h-19 w-[30%] -translate-x-1/2 rounded-lg border border-border bg-muted p-2.5 shadow-sm dark:bg-muted/50"
		>
			<div class="flex items-center justify-between">
				<span class="font-mono text-[0.5625rem] text-muted-foreground">02</span>
				<span class="size-1.5 rounded-full bg-muted-foreground/40"></span>
			</div>
			<p class="mt-3 text-xs font-medium">Controller</p>
			<p class="mt-0.5 font-mono text-[0.5625rem] text-muted-foreground">pause · seek</p>
		</div>

		<div
			class="absolute inset-e-0 top-26 z-10 h-19 w-[30%] rounded-lg border border-border bg-muted p-2.5 shadow-sm dark:bg-muted/50"
		>
			<div class="flex items-center justify-between">
				<span class="font-mono text-[0.5625rem] text-muted-foreground">03</span>
				<span class="size-1.5 rounded-full bg-muted-foreground/40"></span>
			</div>
			<p class="mt-3 text-xs font-medium">CSS linear()</p>
			<p class="mt-0.5 font-mono text-[0.5625rem] text-muted-foreground">export curve</p>
		</div>
	</div>
</div>

<style>
	@keyframes output-pulse {
		0%,
		100% {
			opacity: 0.15;
		}
		50% {
			opacity: 0.8;
		}
	}

	.connector-base,
	.flow-trace {
		fill: none;
		stroke-linecap: round;
		stroke-linejoin: round;
		vector-effect: non-scaling-stroke;
	}

	.connector-base {
		stroke: var(--border);
		stroke-width: 1;
	}

	.flow-trace {
		display: none;
		stroke-width: 1.35;
	}

	@media (prefers-reduced-motion: no-preference) {
		.flow-trace {
			display: inline;
		}
	}
</style>
