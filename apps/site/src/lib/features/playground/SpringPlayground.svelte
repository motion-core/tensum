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
	import { ActionTooltip } from '$lib/components/action-tooltip';
	import { Button } from '$lib/components/ui/button';
	import { PauseIcon, PlayIcon, ResetIcon } from '$lib/icons';
	import { Slider } from '$lib/components/ui/slider';
	import * as Tabs from '$lib/components/ui/tabs';
	import ParameterField from './ParameterField.svelte';
	import SlidingSelectionGroup from './SlidingSelectionGroup.svelte';
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
	let scenarioIndex = $derived(scenarios.findIndex((item) => item.id === scenario));
	let rotationTargetIndex = $derived(
		rotationTargets.findIndex((target) => target === rotationTarget)
	);
	let feelPresetIndex = $derived(
		inputMode === 'perceptual'
			? feelPresets.findIndex((preset) => preset.duration === duration && preset.bounce === bounce)
			: -1
	);
	let inputModeIndex = $derived(inputMode === 'perceptual' ? 0 : 1);

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
	class="spring-playground grid overflow-hidden rounded-xl bg-card shadow-lg lg:grid-cols-12 dark:bg-card/44 dark:inset-shadow-[0_1px_rgb(255_255_255/0.15)]"
	aria-label="Spring playground"
>
	<section
		class="order-2 flex min-w-0 flex-col border-t border-border/64 lg:order-1 lg:col-span-2 lg:border-t-0 dark:border-card/80"
		aria-labelledby="playground-scenes-heading"
	>
		<header
			class="flex h-12 items-center justify-between gap-2 border-b border-border/64 px-4 dark:border-card/80"
		>
			<h2 class="font-heading text-sm font-medium" id="playground-scenes-heading">Scenes</h2>
		</header>
		<div class="p-3">
			<SlidingSelectionGroup
				selectedIndex={scenarioIndex}
				count={scenarios.length}
				role="group"
				aria-label="Playground scene"
			>
				{#each scenarios as item (item.id)}
					<Button
						variant="ghost"
						class="relative z-10 sm:justify-start bg-transparent text-muted-foreground/70 hover:bg-transparent hover:text-foreground aria-pressed:text-foreground"
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
			</SlidingSelectionGroup>

			{#if scenario !== 'timeline'}
				{#if scenario === 'distance'}
					<p id="distance-target-label" class="mt-3 mb-1 px-2 text-xs text-muted-foreground">
						Target
					</p>
					<SlidingSelectionGroup
						selectedIndex={distanceTargetIndex}
						count={distanceTargets.length}
						role="group"
						aria-labelledby="distance-target-label"
					>
						{#each distanceTargets as target, index (target.label)}
							<Button
								variant="ghost"
								class="relative z-10 sm:justify-start bg-transparent text-muted-foreground/70 hover:bg-transparent hover:text-foreground aria-pressed:text-foreground"
								onclick={() => setDistanceTarget(index)}
								aria-pressed={distanceTargetIndex === index}
							>
								{target.label}
							</Button>
						{/each}
					</SlidingSelectionGroup>
				{:else}
					<p id="rotation-target-label" class="mt-3 mb-1 px-2 text-xs text-muted-foreground">
						Target
					</p>
					<SlidingSelectionGroup
						selectedIndex={rotationTargetIndex}
						count={rotationTargets.length}
						role="group"
						aria-labelledby="rotation-target-label"
					>
						{#each rotationTargets as target (target)}
							<Button
								variant="ghost"
								class="relative z-10 sm:justify-start bg-transparent text-muted-foreground/70 hover:bg-transparent hover:text-foreground aria-pressed:text-foreground"
								onclick={() => setRotationTarget(target)}
								aria-pressed={rotationTarget === target}
							>
								{target > 0 ? '+' : ''}{target}°
							</Button>
						{/each}
					</SlidingSelectionGroup>
				{/if}

				<p id="feel-preset-label" class="mt-3 mb-1 px-2 text-xs text-muted-foreground">
					Feel preset
				</p>
				<SlidingSelectionGroup
					selectedIndex={feelPresetIndex}
					count={feelPresets.length}
					role="group"
					aria-labelledby="feel-preset-label"
				>
					{#each feelPresets as preset (preset.label)}
						{@const selected =
							inputMode === 'perceptual' &&
							duration === preset.duration &&
							bounce === preset.bounce}
						<Button
							variant="ghost"
							class="relative z-10 sm:justify-start bg-transparent text-muted-foreground/70 hover:bg-transparent hover:text-foreground aria-pressed:text-foreground"
							onclick={() => applyPreset(preset)}
							aria-pressed={selected}
						>
							{preset.label}
						</Button>
					{/each}
				</SlidingSelectionGroup>
			{:else}
				<p class="mt-4 px-2 text-xs leading-relaxed text-muted-foreground">
					Two analytical springs share one property without competing writes.
				</p>
			{/if}
		</div>
	</section>

	<section
		class="order-1 flex min-w-0 flex-col lg:order-2 lg:col-span-7 lg:border-l lg:border-border/64 dark:lg:border-card/80"
		aria-labelledby="playground-stage-heading"
	>
		<header
			class="flex h-12 items-center justify-between gap-2 border-b border-border/64 px-4 dark:border-card/80"
		>
			<h2 class="font-heading text-sm font-medium" id="playground-stage-heading">Stage</h2>
			<span
				class="font-mono text-xs text-muted-foreground tabular-nums"
				role="status"
				aria-atomic="true">{stageStatus}</span
			>
		</header>
		<div class="flex min-h-48 flex-1 flex-col p-3 lg:min-h-96">
			<div
				class="spring-stage-canvas relative min-h-64 flex-1 overflow-hidden rounded-lg bg-background shadow-[0px_0px_0px_1px_rgba(0,0,0,0.04),0_1px_1px_rgba(0,0,0,0.05),0_2px_2px_rgba(0,0,0,0.05),0_2px_4px_rgba(0,0,0,0.05)] lg:min-h-40 dark:bg-card/64 dark:inset-shadow-[0_1px_rgb(255_255_255/0.15)]"
				{@attach captureTrack}
			>
				{#if scenario === 'rotation'}
					<div
						class="spring-stage-rotation-rail absolute top-1/2 left-1/2 size-44 -translate-x-1/2 -translate-y-1/2 rounded-full border-8 border-muted"
						aria-hidden="true"
					>
						<span
							class="pointer-events-none absolute -inset-1 rounded-full border-4 border-background/65 dark:border-card/50"
						></span>

						<div class="spring-stage-rotation-stop top-0 left-1/2 -translate-x-1/2">
							<span
								class={rotationTarget === -90
									? 'spring-stage-rotation-node bg-primary shadow-[0_0_0_4px_color-mix(in_oklab,var(--primary)_14%,transparent)]'
									: 'spring-stage-rotation-node bg-muted-foreground/45'}
							></span>
							<span class="spring-stage-rotation-label bottom-4 left-1/2 -translate-x-1/2"
								>−90°</span
							>
						</div>

						<div class="spring-stage-rotation-stop top-1/2 right-0 -translate-y-1/2">
							<span
								class={rotationTarget === 0
									? 'spring-stage-rotation-node bg-primary shadow-[0_0_0_4px_color-mix(in_oklab,var(--primary)_14%,transparent)]'
									: 'spring-stage-rotation-node bg-muted-foreground/45'}
							></span>
							<span class="spring-stage-rotation-label top-1/2 left-4 -translate-y-1/2">0°</span>
						</div>

						<div class="spring-stage-rotation-stop bottom-0 left-1/2 -translate-x-1/2">
							<span
								class={rotationTarget === 90
									? 'spring-stage-rotation-node bg-primary shadow-[0_0_0_4px_color-mix(in_oklab,var(--primary)_14%,transparent)]'
									: 'spring-stage-rotation-node bg-muted-foreground/45'}
							></span>
							<span class="spring-stage-rotation-label top-4 left-1/2 -translate-x-1/2">+90°</span>
						</div>
					</div>
				{:else}
					<div
						class="spring-stage-rail absolute inset-x-6 top-1/2 h-2 -translate-y-1/2 rounded-full bg-muted shadow-inner"
						aria-hidden="true"
					>
						<span class="absolute inset-0.5 rounded-full bg-background/65 dark:bg-card/50"></span>
					</div>
					{#if scenario === 'distance'}
						{#each distanceTargets as target, index (target.label)}
							<div
								class="spring-stage-marker absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
								style:left={markerPosition(target.ratio)}
								aria-hidden="true"
							>
								<span
									class={distanceTargetIndex === index
										? 'spring-stage-node border-primary bg-primary shadow-[0_0_0_4px_color-mix(in_oklab,var(--primary)_14%,transparent)]'
										: 'spring-stage-node border-background bg-muted-foreground/45'}
								></span>
								<span class="spring-stage-marker-line"></span>
								<span
									class={distanceTargetIndex === index
										? 'spring-stage-marker-label text-foreground'
										: 'spring-stage-marker-label text-muted-foreground'}>{target.label}</span
								>
							</div>
						{/each}
					{:else}
						<div
							class="spring-stage-marker absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
							style:left={markerPosition(0.22)}
							aria-hidden="true"
						>
							<span class="spring-stage-node border-chart-1 bg-chart-1"></span>
							<span class="spring-stage-marker-line"></span>
							<span class="spring-stage-marker-label text-muted-foreground">Spring A</span>
						</div>
						<div
							class="spring-stage-marker absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
							style:left={markerPosition(0.82)}
							aria-hidden="true"
						>
							<span class="spring-stage-node border-chart-2 bg-chart-2"></span>
							<span class="spring-stage-marker-line"></span>
							<span class="spring-stage-marker-label text-muted-foreground">Spring B</span>
						</div>
					{/if}
				{/if}

				<div
					class={scenario === 'rotation'
						? 'spring-stage-object absolute top-1/2 left-1/2 -mt-3.5 -ml-12 flex h-7 w-24 items-center justify-end rounded-full bg-background shadow-[0px_0px_0px_1px_rgba(0,0,0,0.04),0_1px_1px_rgba(0,0,0,0.05),0_2px_2px_rgba(0,0,0,0.05),0_2px_4px_rgba(0,0,0,0.05)] dark:bg-card dark:inset-shadow-[0_1px_rgb(255_255_255/0.15)]'
						: 'spring-stage-object spring-stage-object-linear absolute bottom-1/2 left-6 mb-3 flex h-10 w-12 items-center justify-center rounded-lg bg-background shadow-[0px_0px_0px_1px_rgba(0,0,0,0.04),0_1px_1px_rgba(0,0,0,0.05),0_2px_2px_rgba(0,0,0,0.05),0_2px_4px_rgba(0,0,0,0.05)] dark:bg-card dark:inset-shadow-[0_1px_rgb(255_255_255/0.15)]'}
					{@attach captureBody}
					aria-hidden="true"
				>
					{#if scenario === 'rotation'}
						<span
							class="absolute left-1/2 size-3 -translate-x-1/2 rounded-full border border-border/64 bg-muted shadow-inner dark:border-card/80"
						></span>
						<span
							class="mr-2 size-2.5 rounded-full bg-primary shadow-[0_0_0_4px_color-mix(in_oklab,var(--primary)_14%,transparent)]"
						></span>
					{:else}
						<span
							class="size-2.5 rounded-full bg-primary shadow-[0_0_0_4px_color-mix(in_oklab,var(--primary)_14%,transparent)]"
						></span>
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
		class="order-3 flex min-w-0 flex-col border-t border-border/64 lg:col-span-3 lg:border-t-0 lg:border-l dark:border-card/80"
		aria-labelledby="playground-inspector-heading"
	>
		<header
			class="flex h-12 items-center justify-between gap-2 border-b border-border/64 px-4 dark:border-card/80"
		>
			<h2 class="font-heading text-sm font-medium" id="playground-inspector-heading">Inspector</h2>
		</header>

		{#if scenario === 'timeline'}
			<div class="flex flex-1 flex-col gap-4 p-4">
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
					<ActionTooltip content="Reset timeline">
						{#snippet trigger({ props })}
							<Button
								{...props}
								variant="ghost"
								size="icon"
								onclick={resetTimeline}
								aria-label="Reset timeline"
							>
								<ResetIcon strokeWidth={2} />
							</Button>
						{/snippet}
					</ActionTooltip>
				</div>

				<p
					class="mt-auto border-t border-border/64 pt-3 text-xs leading-relaxed text-muted-foreground dark:border-card/80"
				>
					Spring B inherits A's position and velocity at exactly {TIMELINE_HANDOFF_TIME}s.
				</p>
			</div>
		{:else}
			<div class="flex flex-1 flex-col gap-4 p-4">
				<Tabs.Root
					class="w-full gap-3"
					value={inputMode}
					onValueChange={(value) => setInputMode(value as InputMode)}
				>
					<Tabs.List
						class="w-full"
						aria-label="Spring input model"
						indicatorIndex={inputModeIndex}
						indicatorCount={2}
					>
						<Tabs.Trigger class="flex-1" value="perceptual">Feel</Tabs.Trigger>
						<Tabs.Trigger class="flex-1" value="physics">Physics</Tabs.Trigger>
					</Tabs.List>

					<Tabs.Content class="grid gap-3" value="perceptual">
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
					</Tabs.Content>

					<Tabs.Content class="grid gap-3" value="physics">
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
					</Tabs.Content>
				</Tabs.Root>

				<Button class="w-full" onclick={moveToNextTarget}>
					<PlayIcon strokeWidth={2} data-icon="inline-start" />
					Run spring
				</Button>

				<dl
					class="mt-auto grid grid-cols-2 gap-3 border-t border-border/64 pt-3 text-xs dark:border-card/80"
				>
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

	<div class="order-4 col-span-full min-w-0 border-t border-border/64 dark:border-card/80">
		<TrajectoryCharts
			samples={trajectory.samples}
			target={trajectory.target}
			positionUnit={stageUnit}
			{velocityUnit}
		/>
	</div>
</section>

<style>
	@media (min-width: 64rem) {
		.spring-playground {
			grid-template-rows: 29.5rem auto;
		}
	}

	.spring-stage-rail {
		box-shadow:
			inset 0 1px 2px rgb(0 0 0 / 0.08),
			0 1px rgb(255 255 255 / 0.06);
	}

	.spring-stage-rotation-rail {
		box-shadow:
			inset 0 1px 2px rgb(0 0 0 / 0.08),
			0 1px rgb(255 255 255 / 0.06);
	}

	.spring-stage-rotation-stop {
		position: absolute;
		z-index: 2;
		width: 0;
		height: 0;
	}

	.spring-stage-rotation-node {
		position: absolute;
		top: 50%;
		left: 50%;
		width: 0.625rem;
		height: 0.625rem;
		translate: -50% -50%;
		border: 2px solid var(--background);
		border-radius: 9999px;
	}

	.spring-stage-rotation-label {
		position: absolute;
		font-family: var(--font-mono);
		font-size: 0.625rem;
		line-height: 1rem;
		color: var(--muted-foreground);
		white-space: nowrap;
	}

	.spring-stage-marker {
		z-index: 1;
		width: 0;
		height: 0;
	}

	.spring-stage-node {
		position: absolute;
		top: 50%;
		left: 50%;
		width: 0.625rem;
		height: 0.625rem;
		translate: -50% -50%;
		border-width: 2px;
		border-radius: 9999px;
	}

	.spring-stage-marker-line {
		position: absolute;
		top: 0.375rem;
		left: 50%;
		width: 1px;
		height: 0.875rem;
		translate: -50% 0;
		background: linear-gradient(to bottom, var(--separator), transparent);
	}

	.spring-stage-marker-label {
		position: absolute;
		top: 1.5rem;
		left: 50%;
		translate: -50% 0;
		font-family: var(--font-mono);
		font-size: 0.625rem;
		line-height: 1rem;
		white-space: nowrap;
	}

	.spring-stage-object {
		z-index: 10;
	}

	.spring-stage-object-linear::after {
		position: absolute;
		top: 100%;
		left: 50%;
		width: 1px;
		height: 0.75rem;
		translate: -50% 0;
		background: color-mix(in oklab, var(--primary) 60%, transparent);
		content: '';
	}
</style>
