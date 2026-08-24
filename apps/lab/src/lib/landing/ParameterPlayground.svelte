<script lang="ts">
	import { springTo } from '@motion-core/gsap-spring';
	import type { SpringController, SpringToSnapshot } from '@motion-core/gsap-spring';
	import { createSpring, springCharacteristics, springParameters } from '@motion-core/spring';
	import { gsap } from 'gsap';
	import { onDestroy, onMount, tick } from 'svelte';
	import type { Attachment } from 'svelte/attachments';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import * as Tabs from '$lib/components/ui/tabs';
	import ParameterField from '$lib/lab/ParameterField.svelte';

	type InputMode = 'perceptual' | 'physics';
	type TargetSide = 'left' | 'right';

	const feelPresets = [
		{ label: 'Gentle', duration: 0.85, bounce: -0.3 },
		{ label: 'Quick', duration: 0.3, bounce: 0.05 },
		{ label: 'Elastic', duration: 0.8, bounce: 0.7 }
	] as const;

	let mode = $state<InputMode>('perceptual');
	let duration = $state(0.3);
	let bounce = $state(0.05);
	let mass = $state(1);
	let stiffness = $state(180);
	let damping = $state(24);
	let targetSide = $state<TargetSide>('left');
	let track = $state<HTMLDivElement | null>(null);
	let body = $state<HTMLDivElement | null>(null);
	let trackWidth = $state(0);
	let prefersReducedMotion = $state(false);
	let status = $state('ready');
	let telemetry = $state({ position: 0, velocity: 0 });
	const controllers: SpringController[] = [];

	let parameters = $derived(
		mode === 'perceptual'
			? springParameters.fromPerceptualDuration({ duration, bounce })
			: springParameters.fromPhysics({ mass, stiffness, damping })
	);
	let characteristics = $derived(springCharacteristics(parameters));
	let settlingDuration = $derived(
		createSpring({ from: 0, to: 1, ...parameters }).getSettlingDuration()
	);

	const captureTrack: Attachment<HTMLDivElement> = (node) => {
		track = node;
		return () => (track = null);
	};

	const captureBody: Attachment<HTMLDivElement> = (node) => {
		body = node;
		return () => (body = null);
	};

	function targetFor(side: TargetSide): number {
		return side === 'left' ? 0 : Math.max(trackWidth - 48, 0);
	}

	function updateTelemetry(snapshot: SpringToSnapshot): void {
		const state = snapshot.states.x;
		if (!state) return;
		telemetry = { position: state.position, velocity: state.velocity };
		status = 'moving';
	}

	function moveTo(side: TargetSide): void {
		if (!body) return;
		targetSide = side;
		const target = targetFor(side);

		if (prefersReducedMotion) {
			gsap.set(body, { x: target });
			telemetry = { position: target, velocity: 0 };
			status = 'reduced';
			return;
		}

		const controller = springTo(body, {
			x: target,
			spring: parameters,
			onUpdate: updateTelemetry,
			onSettle: (snapshot) => {
				const state = snapshot.states.x;
				telemetry = {
					position: state?.position ?? target,
					velocity: state?.velocity ?? 0
				};
				status = 'settled';
			}
		});
		controllers.push(controller);
	}

	async function applyPreset(preset: (typeof feelPresets)[number]): Promise<void> {
		mode = 'perceptual';
		duration = preset.duration;
		bounce = preset.bounce;
		await tick();
		moveTo(targetSide === 'left' ? 'right' : 'left');
	}

	function setMode(nextMode: InputMode): void {
		if (nextMode === mode) return;
		if (nextMode === 'physics') {
			mass = parameters.mass;
			stiffness = parameters.stiffness;
			damping = parameters.damping;
		}
		mode = nextMode;
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
			if (body && status !== 'moving') {
				const target = targetFor(targetSide);
				gsap.set(body, { x: target });
				telemetry = { position: target, velocity: 0 };
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

	onDestroy(() => {
		for (const controller of controllers) controller.kill();
	});
</script>

<Card.Root size="sm">
	<Card.Content>
		<div class="grid gap-4 lg:grid-cols-[10rem_minmax(0,1fr)_13rem]">
			<section
				class="order-2 space-y-4 lg:order-1 lg:border-r lg:border-border lg:pr-4"
				aria-labelledby="model-heading"
			>
				<div class="space-y-1">
					<h3 class="font-heading text-sm font-medium" id="model-heading">Input model</h3>
				</div>

				<Tabs.Root class="w-full" value={mode} onValueChange={(value) => setMode(value as InputMode)}>
					<Tabs.List class="w-full" aria-label="Spring input model">
						<Tabs.Trigger value="perceptual">Feel</Tabs.Trigger>
						<Tabs.Trigger value="physics">Physics</Tabs.Trigger>
					</Tabs.List>
				</Tabs.Root>

				<div class="grid grid-cols-3 gap-2 lg:grid-cols-1" aria-label="Feel presets">
					{#each feelPresets as preset (preset.label)}
						<Button
							variant={mode === 'perceptual' &&
							duration === preset.duration &&
							bounce === preset.bounce
								? 'secondary'
								: 'ghost'}
							onclick={() => applyPreset(preset)}
						>
							{preset.label}
						</Button>
					{/each}
				</div>
			</section>

			<section class="order-1 space-y-4 lg:order-2" aria-labelledby="material-preview-heading">
				<div class="flex items-start justify-between gap-3">
					<div class="space-y-1">
						<h3 class="font-heading text-sm font-medium" id="material-preview-heading">
							Material preview
						</h3>
					</div>
				</div>

				<div
					class="relative min-h-40 overflow-hidden rounded-md border border-border bg-muted"
					{@attach captureTrack}
					aria-hidden="true"
				>
					<div class="absolute inset-x-6 top-1/2 border-t border-border"></div>
					<div
						class="absolute bottom-1/2 left-6 h-12 border-l border-dashed border-muted-foreground"
					></div>
					<div
						class="absolute right-6 bottom-1/2 h-12 border-l border-dashed border-muted-foreground"
					></div>
					<div
						class="absolute bottom-1/2 mb-2 h-8 w-12 rounded-md border border-primary bg-primary shadow-sm"
						{@attach captureBody}
					></div>
				</div>

				<div class="flex flex-wrap items-center justify-between gap-3">
					<div class="flex gap-2">
						<Button
							variant={targetSide === 'left' ? 'secondary' : 'outline'}
							onclick={() => moveTo('left')}
						>
							Move left
						</Button>
						<Button
							variant={targetSide === 'right' ? 'secondary' : 'outline'}
							onclick={() => moveTo('right')}
						>
							Move right
						</Button>
					</div>
				</div>
			</section>

			<section
				class="order-3 space-y-4 lg:border-l lg:border-border lg:pl-4"
				aria-labelledby="parameter-heading"
			>
				<div class="space-y-1">
					<h3 class="font-heading text-sm font-medium" id="parameter-heading">Parameters</h3>

				</div>

				<div class="grid gap-4">
					{#if mode === 'perceptual'}
						<ParameterField
							id="material-duration"
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
							id="material-bounce"
							label="Bounce"
							value={bounce}
							min={-0.5}
							max={0.8}
							step={0.05}
							unit=""
							description="Damping character"
							onValue={(value) => (bounce = value)}
						/>
					{:else}
						<ParameterField
							id="material-mass"
							label="Mass"
							value={mass}
							min={0.25}
							max={3}
							step={0.05}
							unit=""
							description="Resistance to acceleration"
							onValue={(value) => (mass = value)}
						/>
						<ParameterField
							id="material-stiffness"
							label="Stiffness"
							value={stiffness}
							min={40}
							max={500}
							step={5}
							unit=""
							description="Restoring force"
							onValue={(value) => (stiffness = value)}
						/>
						<ParameterField
							id="material-damping"
							label="Damping"
							value={damping}
							min={1}
							max={60}
							step={1}
							unit=""
							description="Energy loss"
							onValue={(value) => (damping = value)}
						/>
					{/if}
				</div>
			</section>
		</div>
	</Card.Content>
</Card.Root>
