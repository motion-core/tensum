<script lang="ts">
	import {
		createSpring,
		registerSpringPlugin,
		springTo,
		springCharacteristics,
		springParameters
	} from '@motion-core/spring';
	import type { SpringController, SpringState, SpringToSnapshot } from '@motion-core/spring';
	import { gsap } from 'gsap';
	import { onDestroy, onMount, tick } from 'svelte';
	import type { Attachment } from 'svelte/attachments';
	import { Button } from '$lib/components/ui/button';
	import { PauseIcon, PlayIcon, ResetIcon } from '$lib/icons';
	import { Slider } from '$lib/components/ui/slider';
	import * as Tabs from '$lib/components/ui/tabs';
	import ParameterField from './ParameterField.svelte';
	import TrajectoryCharts from './TrajectoryCharts.svelte';
	import { createTimelineMotion, createTrajectory, TIMELINE_HANDOFF_TIME } from './trajectory.js';
	import type { PlaygroundScenario } from './trajectory.js';

	type InputMode = 'perceptual' | 'physics';
	type Segment = { start: number; end: number };

	const scenarios = [
		{ id: 'distance', label: 'Distance', detail: 'Retargetable x' },
		{ id: 'rotation', label: 'Rotation', detail: 'Angular spring' },
		{ id: 'timeline', label: 'Timeline', detail: 'GSAP seek and reverse' }
	] as const;
	const feelPresets = [
		{ label: 'Gentle', duration: 0.85, bounce: -0.3 },
		{ label: 'Quick', duration: 0.3, bounce: 0.05 },
		{ label: 'Elastic', duration: 0.8, bounce: 0.7 }
	] as const;
	const distanceTargets = [
		{ label: 'Near', ratio: 0 },
		{ label: 'Middle', ratio: 0.5 },
		{ label: 'Far', ratio: 1 }
	] as const;
	const rotationTargets = [-90, 0, 90] as const;
	let scenario = $state<PlaygroundScenario>('distance');
	let inputMode = $state<InputMode>('perceptual');
	let duration = $state(0.5);
	let bounce = $state(0.15);
	let mass = $state(1);
	let stiffness = $state(180);
	let damping = $state(24);
	let distanceTargetIndex = $state(1);
	let rotationTarget = $state(0);
	let track = $state<HTMLDivElement | null>(null);
	let body = $state<HTMLDivElement | null>(null);
	let trackWidth = $state(0);
	let prefersReducedMotion = $state(false);
	let runtimeStatus = $state('ready');
	let telemetry = $state({ position: 0, velocity: 0 });
	let trajectoryInitialState = $state<SpringState>({ position: 0, velocity: 0 });
	let runtimeController: SpringController | undefined;
	const controllers: SpringController[] = [];

	let currentTime = $state(0);
	let timelineDuration = $state(1);
	let timelineStatus = $state('ready');
	let timelinePosition = $state(0);
	let timeline: gsap.core.Timeline | undefined;
	let segments = $state<{ a: Segment; b: Segment }>({
		a: { start: 0, end: 0.5 },
		b: { start: TIMELINE_HANDOFF_TIME, end: 1 }
	});

	let parameters = $derived(
		inputMode === 'perceptual'
			? springParameters.fromPerceptualDuration({ duration, bounce })
			: springParameters.fromPhysics({ mass, stiffness, damping })
	);
	let characteristics = $derived(springCharacteristics(parameters));
	let settlingDuration = $derived(
		createSpring({ from: 0, to: 1, ...parameters }).getSettlingDuration()
	);
	let timelineMotion = $derived(createTimelineMotion(trackWidth));
	let trajectory = $derived(
		createTrajectory(
			scenario,
			parameters,
			trajectoryInitialState,
			distanceFor(distanceTargetIndex),
			rotationTarget,
			timelineMotion
		)
	);
	let timelineIsRunning = $derived(timelineStatus === 'playing' || timelineStatus === 'reversing');
	let timelineOwner = $derived(
		currentTime <= 0 ? 'ready' : currentTime < segments.b.start ? 'Spring A' : 'Spring B'
	);
	let stageStatus = $derived(scenario === 'timeline' ? timelineOwner : runtimeStatus);
	let stageUnit = $derived(scenario === 'rotation' ? '°' : 'px');
	let velocityUnit = $derived(scenario === 'rotation' ? '°/s' : 'px/s');

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
		return target.ratio * Math.max(trackWidth - 96, 0);
	}

	function markerPosition(ratio: number): string {
		return `calc(${ratio * 100}% + ${48 - ratio * 96}px)`;
	}

	function readBodyX(): number {
		if (!body) return 0;
		const value = gsap.getProperty(body, 'x');
		return typeof value === 'number' ? value : Number.parseFloat(String(value)) || 0;
	}

	function updateRuntimeTelemetry(snapshot: SpringToSnapshot, property: 'x' | 'rotation'): void {
		const state = snapshot.states[property];
		if (!state) return;
		telemetry = { position: state.position, velocity: state.velocity };
	}

	function animateRuntime(property: 'x' | 'rotation', target: number): void {
		if (!body) return;
		const isRetarget = runtimeStatus === 'moving' || runtimeStatus === 'retargeted';

		if (prefersReducedMotion) {
			const value = gsap.getProperty(body, property);
			trajectoryInitialState = {
				position: typeof value === 'number' ? value : Number.parseFloat(String(value)) || 0,
				velocity: 0
			};
			gsap.set(body, { [property]: target });
			telemetry = { position: target, velocity: 0 };
			runtimeStatus = 'reduced motion';
			return;
		}

		runtimeStatus = isRetarget ? 'retargeted' : 'moving';
		const controller = springTo(body, {
			[property]: target,
			spring: parameters,
			onUpdate: (snapshot) => updateRuntimeTelemetry(snapshot, property),
			onSettle: (snapshot) => {
				const state = snapshot.states[property];
				telemetry = {
					position: state?.position ?? target,
					velocity: state?.velocity ?? 0
				};
				runtimeStatus = 'settled';
			}
		});
		const spring = controller.springs[property];
		if (spring) {
			trajectoryInitialState = {
				position: spring.initialState.position,
				velocity: spring.initialState.velocity
			};
		}
		runtimeController = controller;
		controllers.push(controller);
	}

	function setDistanceTarget(index: number): void {
		distanceTargetIndex = index;
		animateRuntime('x', distanceFor(index));
	}

	function setRotationTarget(target: number): void {
		rotationTarget = target;
		animateRuntime('rotation', target);
	}

	function moveToNextTarget(): void {
		if (scenario === 'distance') {
			setDistanceTarget((distanceTargetIndex + 1) % distanceTargets.length);
		} else if (scenario === 'rotation') {
			const index = rotationTargets.indexOf(rotationTarget as (typeof rotationTargets)[number]);
			setRotationTarget(rotationTargets[(index + 1) % rotationTargets.length] ?? 0);
		}
	}

	async function applyPreset(preset: (typeof feelPresets)[number]): Promise<void> {
		inputMode = 'perceptual';
		duration = preset.duration;
		bounce = preset.bounce;
		await tick();
		moveToNextTarget();
	}

	function setInputMode(nextMode: InputMode): void {
		if (nextMode === inputMode) return;
		if (nextMode === 'physics') {
			mass = parameters.mass;
			stiffness = parameters.stiffness;
			damping = parameters.damping;
		}
		inputMode = nextMode;
	}

	function syncTimeline(): void {
		if (!timeline) return;
		currentTime = Math.min(timeline.time(), timelineDuration);
		timelinePosition = readBodyX();
	}

	function buildTimeline(): void {
		if (!body || trackWidth === 0 || scenario !== 'timeline') return;
		timeline?.kill();
		gsap.set(body, { clearProps: 'transform' });
		gsap.set(body, { x: 0, rotation: 0 });

		const motion = createTimelineMotion(trackWidth);

		timelineDuration = motion.duration;
		segments = {
			a: { start: 0, end: motion.firstEnd },
			b: { start: TIMELINE_HANDOFF_TIME, end: motion.secondEnd }
		};
		timeline = gsap
			.timeline({
				paused: true,
				onUpdate: syncTimeline,
				onComplete: () => {
					currentTime = timelineDuration;
					timelinePosition = readBodyX();
					timelineStatus = 'settled';
				},
				onReverseComplete: () => {
					currentTime = 0;
					timelinePosition = 0;
					timelineStatus = 'ready';
				}
			})
			.to(body, {
				motionSpring: {
					x: motion.far,
					rotation: 8,
					parameters: motion.firstParameters
				}
			})
			.to(
				body,
				{
					motionSpring: {
						x: motion.near,
						rotation: -6,
						parameters: motion.secondParameters
					}
				},
				`<${TIMELINE_HANDOFF_TIME}`
			);

		timeline.totalTime(timelineDuration, true);
		timeline.totalTime(0, true).pause();
		currentTime = 0;
		timelinePosition = 0;
		timelineStatus = 'ready';
	}

	function playTimeline(): void {
		if (!timeline) buildTimeline();
		if (!timeline) return;
		if (prefersReducedMotion) {
			timeline.time(timelineDuration, false).pause();
			syncTimeline();
			timelineStatus = 'reduced motion';
			return;
		}
		if (currentTime >= timelineDuration) timeline.time(0, false);
		timelineStatus = 'playing';
		timeline.play();
	}

	function toggleTimelinePlayback(): void {
		if (
			!timeline ||
			timelineStatus === 'ready' ||
			timelineStatus === 'settled' ||
			timelineStatus === 'reduced motion'
		) {
			playTimeline();
			return;
		}

		if (timelineStatus === 'paused') {
			timelineStatus = timeline.reversed() ? 'reversing' : 'playing';
			timeline.resume();
		} else {
			timeline.pause();
			timelineStatus = 'paused';
		}
	}

	function reverseTimeline(): void {
		if (!timeline) buildTimeline();
		if (!timeline) return;
		if (prefersReducedMotion) {
			timeline.time(0, false).pause();
			syncTimeline();
			timelineStatus = 'reduced motion';
			return;
		}
		if (currentTime <= 0) timeline.time(timelineDuration, false);
		timelineStatus = 'reversing';
		timeline.reverse();
	}

	function seekTimeline(time: number): void {
		if (!timeline) return;
		timeline.pause().time(time, false);
		syncTimeline();
		timelineStatus = time <= 0 ? 'ready' : time >= timelineDuration ? 'settled' : 'paused';
	}

	function resetTimeline(): void {
		if (!timeline) return;
		timeline.pause().time(0, false);
		syncTimeline();
		timelineStatus = 'ready';
	}

	async function setScenario(nextScenario: PlaygroundScenario): Promise<void> {
		if (nextScenario === scenario) return;
		runtimeController?.kill();
		runtimeController = undefined;
		timeline?.kill();
		scenario = nextScenario;
		runtimeStatus = 'ready';
		telemetry = { position: 0, velocity: 0 };
		trajectoryInitialState = { position: 0, velocity: 0 };
		await tick();
		if (!body) return;
		gsap.set(body, { clearProps: 'transform' });

		if (nextScenario === 'timeline') {
			buildTimeline();
		} else if (nextScenario === 'distance') {
			const target = distanceFor(distanceTargetIndex);
			gsap.set(body, { x: target });
			telemetry = { position: target, velocity: 0 };
		} else {
			gsap.set(body, { rotation: rotationTarget });
			telemetry = { position: rotationTarget, velocity: 0 };
		}
	}

	onMount(() => {
		registerSpringPlugin(gsap);
		const media = window.matchMedia('(prefers-reduced-motion: reduce)');
		const syncMotionPreference = (): void => {
			prefersReducedMotion = media.matches;
		};
		const resizeObserver = new ResizeObserver((entries) => {
			const entry = entries[0];
			if (!entry) return;
			trackWidth = entry.contentRect.width;
			if (!body) return;

			if (scenario === 'timeline') {
				buildTimeline();
			} else if (
				scenario === 'distance' &&
				runtimeStatus !== 'moving' &&
				runtimeStatus !== 'retargeted'
			) {
				const target = distanceFor(distanceTargetIndex);
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
		timeline?.kill();
	});
</script>

<section
	class="grid overflow-hidden rounded-xl bg-card shadow-sm lg:grid-cols-12"
	aria-label="Spring playground"
>
	<section
		class="order-2 flex min-w-0 flex-col border-t border-border lg:order-1 lg:col-span-2 lg:border-t-0"
		aria-labelledby="playground-scenes-heading"
	>
		<header class="flex h-10 items-center justify-between gap-2 border-b border-border px-3">
			<h2 class="font-heading text-sm font-medium" id="playground-scenes-heading">Scenes</h2>
		</header>
		<div class="p-2">
			<nav class="grid grid-cols-3 gap-1 lg:grid-cols-1" aria-label="Playground scene">
				{#each scenarios as item (item.id)}
					<Button
						variant={scenario === item.id ? 'secondary' : 'ghost'}
						class="justify-start"
						onclick={() => setScenario(item.id)}
						aria-pressed={scenario === item.id}
						title={item.detail}
					>
						<span
							class={scenario === item.id
								? 'size-1.5 rounded-full bg-primary'
								: 'size-1.5 rounded-full bg-muted-foreground/40'}
							aria-hidden="true"
						></span>
						{item.label}
					</Button>
				{/each}
			</nav>

			{#if scenario !== 'timeline'}
				<p class="mt-3 mb-1 px-2 text-xs text-muted-foreground">Target</p>
				{#if scenario === 'distance'}
					<div class="grid grid-cols-3 gap-1 lg:grid-cols-1" aria-label="Distance target">
						{#each distanceTargets as target, index (target.label)}
							<Button
								variant={distanceTargetIndex === index ? 'secondary' : 'ghost'}
								class="justify-start"
								onclick={() => setDistanceTarget(index)}
								aria-pressed={distanceTargetIndex === index}
							>
								{target.label}
							</Button>
						{/each}
					</div>
				{:else}
					<div class="grid grid-cols-3 gap-1 lg:grid-cols-1" aria-label="Rotation target">
						{#each rotationTargets as target (target)}
							<Button
								variant={rotationTarget === target ? 'secondary' : 'ghost'}
								class="justify-start"
								onclick={() => setRotationTarget(target)}
								aria-pressed={rotationTarget === target}
							>
								{target > 0 ? '+' : ''}{target}°
							</Button>
						{/each}
					</div>
				{/if}

				<p class="mt-3 mb-1 px-2 text-xs text-muted-foreground">Feel preset</p>
				<div class="grid grid-cols-3 gap-1 lg:grid-cols-1">
					{#each feelPresets as preset (preset.label)}
						<Button
							variant={inputMode === 'perceptual' &&
							duration === preset.duration &&
							bounce === preset.bounce
								? 'secondary'
								: 'ghost'}
							class="justify-start"
							onclick={() => applyPreset(preset)}
						>
							{preset.label}
						</Button>
					{/each}
				</div>
			{:else}
				<p class="mt-4 px-2 text-xs leading-relaxed text-muted-foreground">
					Two analytical springs share one property without competing writes.
				</p>
			{/if}
		</div>
	</section>

	<section
		class="order-1 flex min-w-0 flex-col lg:order-2 lg:col-span-7 lg:border-l lg:border-border"
		aria-labelledby="playground-stage-heading"
	>
		<header class="flex h-10 items-center justify-between gap-2 border-b border-border px-3">
			<h2 class="font-heading text-sm font-medium" id="playground-stage-heading">Stage</h2>
			<span class="font-mono text-xs text-muted-foreground tabular-nums">{stageStatus}</span>
		</header>
		<div class="flex min-h-48 flex-1 flex-col p-2 lg:min-h-96">
			<div class="relative min-h-32 flex-1 overflow-hidden lg:min-h-40" {@attach captureTrack}>
				{#if scenario === 'rotation'}
					<div
						class="absolute top-1/2 left-1/2 size-40 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-border"
						aria-hidden="true"
					></div>
					<div class="absolute inset-x-8 top-1/2 border-t border-border" aria-hidden="true"></div>
					<div class="absolute inset-y-8 left-1/2 border-l border-border" aria-hidden="true"></div>
				{:else}
					<div class="absolute inset-x-6 top-1/2 border-t border-border" aria-hidden="true"></div>
					{#if scenario === 'distance'}
						{#each distanceTargets as target (target.label)}
							<div
								class="absolute bottom-1/2 h-12 border-l border-dashed border-muted-foreground"
								style:left={markerPosition(target.ratio)}
								aria-hidden="true"
							></div>
						{/each}
					{:else}
						<div
							class="absolute bottom-1/2 h-12 border-l border-dashed border-muted-foreground"
							style:left={markerPosition(0.22)}
							aria-hidden="true"
						></div>
						<div
							class="absolute bottom-1/2 h-12 border-l border-dashed border-muted-foreground"
							style:left={markerPosition(0.82)}
							aria-hidden="true"
						></div>
					{/if}
				{/if}

				<div
					class={scenario === 'rotation'
						? 'absolute top-1/2 left-1/2 -mt-6 -ml-10 flex h-12 w-20 items-center justify-end rounded-md border border-primary bg-primary shadow-sm'
						: 'absolute bottom-1/2 left-6 mb-2 h-8 w-12 rounded-md border border-primary bg-primary shadow-sm'}
					{@attach captureBody}
					aria-hidden="true"
				>
					{#if scenario === 'rotation'}
						<span class="mr-2 size-2 rounded-full bg-primary-foreground"></span>
					{/if}
				</div>

				<div
					class="absolute top-3 right-3 flex gap-3 font-mono text-xs text-muted-foreground tabular-nums"
				>
					{#if scenario === 'timeline'}
						<span>t {currentTime.toFixed(3)}s</span>
						<span>x {timelinePosition.toFixed(1)}px</span>
					{:else}
						<span>{telemetry.position.toFixed(1)}{stageUnit}</span>
						<span>{telemetry.velocity.toFixed(1)}{velocityUnit}</span>
					{/if}
				</div>
			</div>
		</div>
	</section>

	<section
		class="order-3 flex min-w-0 flex-col border-t border-border lg:col-span-3 lg:border-t-0 lg:border-l"
		aria-labelledby="playground-inspector-heading"
	>
		<header class="flex h-10 items-center justify-between gap-2 border-b border-border px-3">
			<h2 class="font-heading text-sm font-medium" id="playground-inspector-heading">Inspector</h2>
		</header>

		{#if scenario === 'timeline'}
			<div class="flex flex-1 flex-col gap-3 p-2.5">
				<Slider
					type="single"
					id="hero-timeline-time"
					label="Timeline time"
					displayValue={`${currentTime.toFixed(2)}s`}
					min={0}
					max={timelineDuration}
					step={0.001}
					value={currentTime}
					onValueChange={seekTimeline}
				/>

				<div class="flex flex-wrap gap-1">
					<Button onclick={toggleTimelinePlayback}>
						{#if timelineIsRunning}
							<PauseIcon strokeWidth={2} data-icon="inline-start" />
							Pause
						{:else}
							<PlayIcon strokeWidth={2} data-icon="inline-start" />
							Play
						{/if}
					</Button>
					<Button variant="outline" onclick={reverseTimeline}>Reverse</Button>
					<Button variant="ghost" size="icon" onclick={resetTimeline} aria-label="Reset timeline">
						<ResetIcon strokeWidth={2} />
					</Button>
				</div>

				<p
					class="mt-auto border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground"
				>
					Spring B inherits A's position and velocity at exactly {TIMELINE_HANDOFF_TIME}s.
				</p>
			</div>
		{:else}
			<div class="flex flex-1 flex-col gap-3 p-2.5">
				<Tabs.Root
					class="w-full"
					value={inputMode}
					onValueChange={(value) => setInputMode(value as InputMode)}
				>
					<Tabs.List class="w-full" aria-label="Spring input model">
						<Tabs.Trigger class="flex-1" value="perceptual">Feel</Tabs.Trigger>
						<Tabs.Trigger class="flex-1" value="physics">Physics</Tabs.Trigger>
					</Tabs.List>
				</Tabs.Root>

				<div class="grid gap-3">
					{#if inputMode === 'perceptual'}
						<ParameterField
							id="hero-duration"
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
							id="hero-bounce"
							label="Bounce"
							value={bounce}
							min={-0.5}
							max={0.8}
							step={0.05}
							unit=""
							description="Overshoot and damping character"
							onValue={(value) => (bounce = value)}
						/>
					{:else}
						<ParameterField
							id="hero-mass"
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
							id="hero-stiffness"
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
							id="hero-damping"
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

				<Button class="w-full" onclick={moveToNextTarget}>
					<PlayIcon strokeWidth={2} data-icon="inline-start" />
					Run spring
				</Button>

				<dl class="mt-auto grid grid-cols-2 gap-3 border-t border-border pt-3 text-xs">
					<div>
						<dt class="text-xs text-muted-foreground">Damping ratio</dt>
						<dd class="font-mono tabular-nums">{characteristics.dampingRatio.toFixed(3)}</dd>
					</div>
					<div>
						<dt class="text-xs text-muted-foreground">Settling</dt>
						<dd class="font-mono tabular-nums">{settlingDuration.toFixed(3)}s</dd>
					</div>
				</dl>
			</div>
		{/if}
	</section>

	<div class="order-4 col-span-full min-w-0 border-t border-border">
		<TrajectoryCharts
			samples={trajectory.samples}
			target={trajectory.target}
			positionUnit={stageUnit}
			{velocityUnit}
		/>
	</div>
</section>
