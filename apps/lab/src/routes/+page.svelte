<script lang="ts">
	import type { SpringSolution } from '@real-spring/spring-core';
	import { springTo } from '@real-spring/gsap-spring';
	import type { SpringController, SpringToSnapshot } from '@real-spring/gsap-spring';
	import { gsap } from 'gsap';
	import { onDestroy, onMount } from 'svelte';
	import { Badge } from '$lib/components/ui/badge';
	import * as Card from '$lib/components/ui/card';
	import { Switch } from '$lib/components/ui/switch';
	import SpringControls from '$lib/lab/SpringControls.svelte';
	import SpringStage from '$lib/lab/SpringStage.svelte';
	import SpringTelemetry from '$lib/lab/SpringTelemetry.svelte';
	import TrajectoryGraph from '$lib/lab/TrajectoryGraph.svelte';
	import { DEFAULT_PARAMETERS, createLabSpring, sampleTrajectory } from '$lib/lab/model.js';
	import type { LabParameterName, LabParameters, LabTelemetry } from '$lib/lab/model.js';

	let parameters = $state<LabParameters>({ ...DEFAULT_PARAMETERS });
	let telemetry = $state<LabTelemetry>({
		elapsed: 0,
		position: 0,
		velocity: 0,
		status: 'idle'
	});
	let stageElement = $state<HTMLElement | null>(null);
	let controller: SpringController | undefined;
	let activeSpring = $state<SpringSolution>(createLabSpring(parameters));
	let prefersReducedMotion = $state(false);
	let inspectMotion = $state(false);
	let lastTelemetrySample = 0;

	let trajectory = $derived(sampleTrajectory(parameters));
	let motionAllowed = $derived(!prefersReducedMotion || inspectMotion);

	onMount(() => {
		const query = window.matchMedia('(prefers-reduced-motion: reduce)');
		const updatePreference = (): void => {
			prefersReducedMotion = query.matches;
		};

		updatePreference();
		query.addEventListener('change', updatePreference);
		return () => query.removeEventListener('change', updatePreference);
	});

	onDestroy(() => controller?.kill());

	function handleParameterChange(name: LabParameterName, value: number): void {
		parameters[name] = value;
	}

	function updateTelemetry(snapshot: SpringToSnapshot, force = false): void {
		const now = performance.now();
		if (!force && now - lastTelemetrySample < 32) return;
		lastTelemetrySample = now;
		const state = snapshot.states.x;
		if (!state) return;
		telemetry = {
			elapsed: snapshot.elapsed,
			position: state.position,
			velocity: state.velocity,
			status: snapshot.elapsed >= snapshot.duration ? 'settled' : 'running'
		};
	}

	function runMovement(target = parameters.target, velocity = parameters.initialVelocity): void {
		if (!stageElement) return;

		parameters.target = target;
		parameters.initialVelocity = velocity;
		controller?.kill();
		gsap.set(stageElement, { x: 0 });
		activeSpring = createLabSpring(parameters, target, velocity);

		if (!motionAllowed) {
			gsap.set(stageElement, { x: target });
			telemetry = { elapsed: 0, position: target, velocity: 0, status: 'reduced' };
			return;
		}

		telemetry = { elapsed: 0, position: 0, velocity, status: 'running' };
		lastTelemetrySample = 0;
		controller = springTo(stageElement, {
			x: target,
			velocity: { x: velocity },
			spring: {
				mass: parameters.mass,
				stiffness: parameters.stiffness,
				damping: parameters.damping,
				settle: {
					position: parameters.positionEpsilon,
					velocity: parameters.velocityEpsilon
				}
			},
			onUpdate: (snapshot) => updateTelemetry(snapshot),
			onComplete: () => {
				if (!controller) return;
				updateTelemetry(controller.getSnapshot(), true);
			}
		});
		activeSpring = controller.springs.x ?? activeSpring;
	}
</script>

<svelte:head>
	<title>Real Spring Lab</title>
	<meta
		name="description"
		content="An interactive laboratory for deterministic spring physics driven by GSAP time."
	/>
</svelte:head>

<a
	class="fixed top-2 left-2 z-50 -translate-y-20 rounded-md px-3 py-2 text-sm font-medium shadow-md focus:translate-y-0 focus:bg-background"
	href="#main-content"
>
	Skip to laboratory
</a>

<div class="flex min-h-svh flex-col md:h-svh md:overflow-hidden">
	<header class="shrink-0 border-b border-border bg-background/80 backdrop-blur-md">
		<div class="mx-auto flex max-w-[96rem] items-center justify-between gap-3 px-3 py-2">
			<div class="min-w-0">
				<div class="flex items-center gap-2">
					<h1 class="truncate font-heading text-lg font-semibold tracking-tight">
						Real Spring Lab
					</h1>
					<Badge variant="secondary">experimental</Badge>
				</div>
				<p class="truncate text-muted-foreground">
					Deterministic closed-form motion. Duration is output, not input.
				</p>
			</div>

			<div class="flex shrink-0 items-center gap-2">
				<label class="hidden sm:block" for="inspect-motion">
					{prefersReducedMotion ? 'Inspect motion' : 'Motion enabled'}
				</label>
				<Switch id="inspect-motion" bind:checked={inspectMotion} aria-describedby="motion-note" />
				<span class="sr-only" id="motion-note">
					Override reduced-motion behavior to inspect spring animation.
				</span>
			</div>
		</div>
	</header>

	<main class="mx-auto min-h-0 w-full max-w-[96rem] flex-1 p-3" id="main-content">
		{#if prefersReducedMotion && !inspectMotion}
			<p class="sr-only" role="status">
				Motion completes immediately. Enable inspection to run the physical trajectory.
			</p>
		{/if}

		<div class="grid h-full min-h-0 gap-3 md:grid-cols-[18rem_minmax(0,1fr)]">
			<Card.Root size="sm" class="min-h-0">
				<Card.Header>
					<Card.Title>Physical inputs</Card.Title>
					<Card.Description>Spring state and material constants.</Card.Description>
				</Card.Header>
				<Card.Content class="min-h-0 flex-1 overflow-y-auto">
					<SpringControls
						{parameters}
						onChange={handleParameterChange}
						onRun={() => runMovement()}
						onTarget={(target) => runMovement(target, 0)}
					/>
				</Card.Content>
			</Card.Root>

			<div class="grid min-h-0 grid-rows-[minmax(12rem,1fr)_auto_minmax(9rem,0.72fr)] gap-3">
				<SpringStage
					bind:element={stageElement}
					target={parameters.target}
					status={telemetry.status}
				/>
				<SpringTelemetry spring={activeSpring} {telemetry} />
				<TrajectoryGraph samples={trajectory} target={parameters.target} />
			</div>
		</div>
	</main>
</div>
