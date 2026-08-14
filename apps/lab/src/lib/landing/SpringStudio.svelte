<script lang="ts">
	import { springTo } from '@motion-core/gsap-spring';
	import type { SpringController, SpringToSnapshot } from '@motion-core/gsap-spring';
	import { springParameters } from '@motion-core/spring';
	import { gsap } from 'gsap';
	import { onDestroy, onMount, tick } from 'svelte';
	import type { Attachment } from 'svelte/attachments';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import ParameterField from '$lib/lab/ParameterField.svelte';

	type AnimationMode = 'distance' | 'rotation';

	const distanceTargets = [
		{ label: 'Near', value: 0, ratio: 0 },
		{ label: 'Middle', value: 0.5, ratio: 0.5 },
		{ label: 'Far', value: 1, ratio: 1 }
	] as const;
	const rotationTargets = [
		{ label: '−90°', value: -90 },
		{ label: '0°', value: 0 },
		{ label: '+90°', value: 90 }
	] as const;

	let mode = $state<AnimationMode>('distance');
	let duration = $state(0.5);
	let bounce = $state(0.15);
	let initialVelocity = $state(0);
	let track = $state<HTMLDivElement | null>(null);
	let body = $state<HTMLDivElement | null>(null);
	let trackWidth = $state(0);
	let distanceTargetIndex = $state(1);
	let rotationTarget = $state(0);
	let controller: SpringController | undefined;
	let prefersReducedMotion = $state(false);
	let telemetry = $state({ value: 0, velocity: 0, state: 'ready' });

	let parameters = $derived(
		springParameters.fromPerceptualDuration({
			duration,
			bounce
		})
	);
	let valueUnit = $derived(mode === 'distance' ? 'px' : 'deg');
	let velocityUnit = $derived(mode === 'distance' ? 'px/s' : 'deg/s');
	let distanceTarget = $derived(distanceFor(distanceTargetIndex));
	let activeTarget = $derived(mode === 'distance' ? distanceTarget : rotationTarget);

	const captureTrack: Attachment<HTMLDivElement> = (node) => {
		track = node;
		return () => (track = null);
	};

	const captureBody: Attachment<HTMLDivElement> = (node) => {
		body = node;
		return () => (body = null);
	};

	function distanceFor(index: number): number {
		const target = distanceTargets[index] ?? distanceTargets[1];
		return target.ratio * Math.max(trackWidth - 48, 0);
	}

	function markerPosition(index: number): string {
		const target = distanceTargets[index] ?? distanceTargets[1];
		return `calc(${target.ratio * 100}% + ${24 - target.ratio * 48}px)`;
	}

	function updateTelemetry(snapshot: SpringToSnapshot, property: 'x' | 'rotation'): void {
		const state = snapshot.states[property];
		if (!state) return;
		telemetry = {
			value: state.position,
			velocity: state.velocity,
			state: 'moving'
		};
	}

	function animate(property: 'x' | 'rotation', target: number): void {
		if (!body) return;
		if (prefersReducedMotion) {
			gsap.set(body, { [property]: target });
			telemetry = { value: target, velocity: 0, state: 'reduced' };
			return;
		}

		controller = springTo(body, {
			[property]: target,
			velocity: { [property]: initialVelocity },
			spring: parameters,
			onUpdate: (snapshot) => updateTelemetry(snapshot, property),
			onSettle: (snapshot) => {
				const state = snapshot.states[property];
				telemetry = {
					value: state?.position ?? target,
					velocity: state?.velocity ?? 0,
					state: 'settled'
				};
			}
		});
	}

	function setDistanceTarget(index: number): void {
		distanceTargetIndex = index;
		animate('x', distanceFor(index));
	}

	function setRotationTarget(target: number): void {
		rotationTarget = target;
		animate('rotation', target);
	}

	async function setMode(nextMode: AnimationMode): Promise<void> {
		if (nextMode === mode) return;
		controller?.kill();
		mode = nextMode;
		telemetry = { value: 0, velocity: 0, state: 'ready' };
		await tick();
		if (!body) return;
		gsap.set(body, { clearProps: 'transform' });
		if (nextMode === 'distance') {
			const target = distanceFor(distanceTargetIndex);
			gsap.set(body, { x: target });
			telemetry.value = target;
		} else {
			gsap.set(body, { rotation: rotationTarget });
			telemetry.value = rotationTarget;
		}
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
			if (body && mode === 'distance' && telemetry.state !== 'moving') {
				const target = distanceFor(distanceTargetIndex);
				gsap.set(body, { x: target });
				telemetry = { value: target, velocity: 0, state: 'ready' };
			}
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

<Card.Root>
	<Card.Content>
		<div class="grid gap-4 lg:grid-cols-[12rem_minmax(0,1fr)_15rem]">
			<section
				class="order-2 space-y-4 lg:order-1 lg:border-r lg:border-border lg:pr-4"
				aria-labelledby="animation-heading"
			>
				<div class="space-y-1">
					<h2 class="font-heading text-sm font-medium" id="animation-heading">Animation</h2>
					<p class="text-muted-foreground">Choose the animated property and its next target.</p>
				</div>

				<div class="grid gap-2">
					<Button
						variant={mode === 'distance' ? 'default' : 'outline'}
						onclick={() => setMode('distance')}
						aria-pressed={mode === 'distance'}
					>
						Distance
					</Button>
					<Button
						variant={mode === 'rotation' ? 'default' : 'outline'}
						onclick={() => setMode('rotation')}
						aria-pressed={mode === 'rotation'}
					>
						Rotation
					</Button>
				</div>

				<div class="space-y-2">
					<p class="font-medium">Target</p>
					<div class="grid gap-2">
						{#if mode === 'distance'}
							{#each distanceTargets as target, index (target.label)}
								<Button
									variant={distanceTargetIndex === index ? 'secondary' : 'ghost'}
									onclick={() => setDistanceTarget(index)}
									aria-pressed={distanceTargetIndex === index}
								>
									{target.label}
								</Button>
							{/each}
						{:else}
							{#each rotationTargets as target (target.label)}
								<Button
									variant={rotationTarget === target.value ? 'secondary' : 'ghost'}
									onclick={() => setRotationTarget(target.value)}
									aria-pressed={rotationTarget === target.value}
								>
									{target.label}
								</Button>
							{/each}
						{/if}
					</div>
				</div>
			</section>

			<section class="order-1 space-y-4 lg:order-2" aria-labelledby="preview-heading">
				<div class="flex items-start justify-between gap-3">
					<div class="space-y-1">
						<h2 class="font-heading text-sm font-medium" id="preview-heading">Preview</h2>
						<p class="text-muted-foreground">
							{mode === 'distance'
								? 'Linear displacement with momentum.'
								: 'Angular displacement around a fixed axis.'}
						</p>
					</div>
					<Badge variant={telemetry.state === 'moving' ? 'default' : 'secondary'}>
						{telemetry.state}
					</Badge>
				</div>

				<div
					class="relative min-h-64 overflow-hidden rounded-md border border-border bg-muted"
					{@attach captureTrack}
					aria-hidden="true"
				>
					{#if mode === 'distance'}
						<div class="absolute inset-x-4 top-1/2 border-t border-border"></div>
						{#each distanceTargets as target, index (target.label)}
							<div
								class="absolute bottom-1/2 h-16 border-l border-dashed border-border"
								style:left={markerPosition(index)}
							></div>
						{/each}
						<div
							class="absolute bottom-1/2 mb-2 h-8 w-12 rounded-md border border-primary bg-primary shadow-sm"
							{@attach captureBody}
						></div>
					{:else}
						<div
							class="absolute top-1/2 left-1/2 size-40 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-border"
						></div>
						<div class="absolute inset-x-12 top-1/2 border-t border-border"></div>
						<div
							class="absolute top-1/2 left-1/2 h-24 -translate-y-1/2 border-l border-border"
						></div>
						<div
							class="absolute top-1/2 left-1/2 -mt-6 -ml-10 flex h-12 w-20 items-center justify-end rounded-md border border-primary bg-primary shadow-sm"
							{@attach captureBody}
						>
							<span class="mr-2 size-2 rounded-full bg-primary-foreground"></span>
						</div>
					{/if}
				</div>

				<div class="grid grid-cols-3 gap-3 text-muted-foreground">
					<div>
						<p>Value</p>
						<p class="font-mono text-foreground tabular-nums">
							{telemetry.value.toFixed(1)}
							{valueUnit}
						</p>
					</div>
					<div>
						<p>Velocity</p>
						<p class="font-mono text-foreground tabular-nums">
							{telemetry.velocity.toFixed(1)}
							{velocityUnit}
						</p>
					</div>
					<div>
						<p>Target</p>
						<p class="font-mono text-foreground tabular-nums">
							{activeTarget.toFixed(1)}
							{valueUnit}
						</p>
					</div>
				</div>
			</section>

			<section
				class="order-3 space-y-4 lg:border-l lg:border-border lg:pl-4"
				aria-labelledby="parameters-heading"
			>
				<div class="space-y-1">
					<h2 class="font-heading text-sm font-medium" id="parameters-heading">Parameters</h2>
					<p class="text-muted-foreground">Adjust the next spring without changing its model.</p>
				</div>

				<div class="grid gap-4">
					<ParameterField
						id="studio-duration"
						label="Duration"
						value={duration}
						min={0.2}
						max={1.2}
						step={0.05}
						unit="s"
						description="Perceptual duration"
						onValue={(value) => (duration = value)}
					/>
					<ParameterField
						id="studio-bounce"
						label="Bounce"
						value={bounce}
						min={-0.5}
						max={0.8}
						step={0.05}
						unit=""
						description="Overshoot and damping character"
						onValue={(value) => (bounce = value)}
					/>
					<ParameterField
						id="studio-velocity"
						label="Initial velocity"
						value={initialVelocity}
						min={-1200}
						max={1200}
						step={50}
						unit={velocityUnit}
						description="Velocity used when there is no active handoff"
						onValue={(value) => (initialVelocity = value)}
					/>
				</div>
			</section>
		</div>
	</Card.Content>
</Card.Root>
