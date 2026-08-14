<script lang="ts">
	import { springTo } from '@motion-core/gsap-spring';
	import type { SpringController } from '@motion-core/gsap-spring';
	import { createSpring, springParameters } from '@motion-core/spring';
	import { gsap } from 'gsap';
	import { onDestroy, onMount } from 'svelte';
	import type { Attachment } from 'svelte/attachments';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Slider } from '$lib/components/ui/slider';

	const presets = [
		{ label: 'Smooth', duration: 0.5, bounce: 0 },
		{ label: 'Snappy', duration: 0.5, bounce: 0.15 },
		{ label: 'Bouncy', duration: 0.5, bounce: 0.3 }
	] as const;

	let duration = $state(0.5);
	let bounce = $state(0.15);
	let track = $state<HTMLDivElement | null>(null);
	let body = $state<HTMLDivElement | null>(null);
	let trackWidth = $state(0);
	let atEnd = $state(false);
	let prefersReducedMotion = $state(false);
	let controller: SpringController | undefined;

	let parameters = $derived(
		springParameters.fromPerceptualDuration({
			duration,
			bounce
		})
	);
	let path = $derived(trajectoryPath(duration, bounce));

	const captureTrack: Attachment<HTMLDivElement> = (node) => {
		track = node;
		return () => (track = null);
	};

	const captureBody: Attachment<HTMLDivElement> = (node) => {
		body = node;
		return () => (body = null);
	};

	function trajectoryPath(nextDuration: number, nextBounce: number): string {
		const solution = createSpring({
			from: 0,
			to: 1,
			...springParameters.fromPerceptualDuration({
				duration: nextDuration,
				bounce: nextBounce
			})
		});
		const sampleDuration = Math.max(solution.getSettlingDuration(), nextDuration);
		return Array.from({ length: 96 }, (_, index) => {
			const progress = index / 95;
			const x = progress * 100;
			const value = solution.positionAt(progress * sampleDuration);
			const y = 34 - value * 24;
			return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
		}).join(' ');
	}

	function run(): void {
		if (!body) return;
		atEnd = !atEnd;
		const target = atEnd ? Math.max(trackWidth - 20, 0) : 0;

		if (prefersReducedMotion) {
			gsap.set(body, { x: target });
			return;
		}

		controller = springTo(body, {
			x: target,
			spring: parameters
		});
	}

	function applyPreset(preset: (typeof presets)[number]): void {
		duration = preset.duration;
		bounce = preset.bounce;
		run();
	}

	onMount(() => {
		const media = window.matchMedia('(prefers-reduced-motion: reduce)');
		const syncMotionPreference = (): void => {
			prefersReducedMotion = media.matches;
		};
		const resizeObserver = new ResizeObserver((entries) => {
			const entry = entries[0];
			if (!entry) return;
			trackWidth = entry.contentRect.width;
			if (body) gsap.set(body, { x: atEnd ? Math.max(trackWidth - 20, 0) : 0 });
		});

		syncMotionPreference();
		media.addEventListener('change', syncMotionPreference);
		if (track) resizeObserver.observe(track);

		return () => {
			media.removeEventListener('change', syncMotionPreference);
			resizeObserver.disconnect();
		};
	});

	onDestroy(() => controller?.kill());
</script>

<div class="grid gap-3 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
	<Card.Root>
		<Card.Header>
			<Card.Title>Perceptual parameters</Card.Title>
			<Card.Description>
				Use duration and bounce, then keep the same analytical solver underneath.
			</Card.Description>
		</Card.Header>
		<Card.Content>
			<div class="space-y-4">
				<div class="grid grid-cols-3 gap-2" aria-label="Spring presets">
					{#each presets as preset (preset.label)}
						<Button
							variant={duration === preset.duration && bounce === preset.bounce
								? 'secondary'
								: 'outline'}
							onclick={() => applyPreset(preset)}
						>
							{preset.label}
						</Button>
					{/each}
				</div>

				<div class="space-y-2">
					<div class="flex items-center justify-between gap-3">
						<label for="landing-duration">Perceptual duration</label>
						<output class="font-mono text-muted-foreground tabular-nums" for="landing-duration">
							{duration.toFixed(2)} s
						</output>
					</div>
					<Slider
						type="single"
						id="landing-duration"
						min={0.2}
						max={1.2}
						step={0.05}
						value={duration}
						aria-label="Perceptual duration"
						onValueChange={(value) => (duration = value)}
					/>
				</div>

				<div class="space-y-2">
					<div class="flex items-center justify-between gap-3">
						<label for="landing-bounce">Bounce</label>
						<output class="font-mono text-muted-foreground tabular-nums" for="landing-bounce">
							{bounce.toFixed(2)}
						</output>
					</div>
					<Slider
						type="single"
						id="landing-bounce"
						min={-0.5}
						max={0.8}
						step={0.05}
						value={bounce}
						aria-label="Bounce"
						onValueChange={(value) => (bounce = value)}
					/>
				</div>

				<div class="grid grid-cols-2 gap-3 text-muted-foreground">
					<div>
						<p>Stiffness</p>
						<p class="font-mono text-foreground tabular-nums">{parameters.stiffness.toFixed(1)}</p>
					</div>
					<div>
						<p>Damping</p>
						<p class="font-mono text-foreground tabular-nums">{parameters.damping.toFixed(1)}</p>
					</div>
				</div>
			</div>
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title>One model, two views</Card.Title>
			<Card.Description>
				The trace and the moving value are sampled from the same physical spring.
			</Card.Description>
			<Card.Action>
				<Button variant="outline" onclick={run}>Run spring</Button>
			</Card.Action>
		</Card.Header>
		<Card.Content>
			<div class="space-y-4">
				<div
					class="relative min-h-24 overflow-hidden rounded-md border border-border bg-muted"
					{@attach captureTrack}
					aria-hidden="true"
				>
					<div class="absolute inset-x-3 top-1/2 border-t border-border"></div>
					<div
						class="absolute bottom-1/2 mb-1 size-5 rounded-md border border-primary bg-primary shadow-sm"
						{@attach captureBody}
					></div>
				</div>

				<div
					class="overflow-hidden rounded-md border border-border bg-muted"
					aria-label="Spring position trace"
				>
					<svg
						viewBox="0 0 100 40"
						class="block aspect-[5/2] w-full"
						role="img"
						aria-labelledby="trace-title trace-description"
					>
						<title id="trace-title">Spring position over time</title>
						<desc id="trace-description">
							An analytical position trace for the selected duration and bounce.
						</desc>
						<line
							x1="0"
							y1="34"
							x2="100"
							y2="34"
							class="stroke-border"
							vector-effect="non-scaling-stroke"
						/>
						<line
							x1="0"
							y1="10"
							x2="100"
							y2="10"
							class="stroke-border"
							stroke-dasharray="2 3"
							vector-effect="non-scaling-stroke"
						/>
						<path d={path} class="fill-none stroke-primary" vector-effect="non-scaling-stroke" />
					</svg>
				</div>
			</div>
		</Card.Content>
	</Card.Root>
</div>
