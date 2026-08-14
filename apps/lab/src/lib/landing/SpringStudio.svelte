<script lang="ts">
	import { springTo } from '@motion-core/gsap-spring';
	import type { SpringController, SpringToSnapshot } from '@motion-core/gsap-spring';
	import { springPresets } from '@motion-core/spring';
	import { gsap } from 'gsap';
	import { onDestroy, onMount } from 'svelte';
	import type { Attachment } from 'svelte/attachments';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';

	const destinations = [
		{ label: 'Start', ratio: 0 },
		{ label: 'Center', ratio: 0.5 },
		{ label: 'End', ratio: 1 }
	] as const;

	let track = $state<HTMLDivElement | null>(null);
	let body = $state<HTMLDivElement | null>(null);
	let trackWidth = $state(0);
	let destinationIndex = $state(1);
	let controller: SpringController | undefined;
	let prefersReducedMotion = $state(false);
	let telemetry = $state({ position: 0, velocity: 0, state: 'ready' });

	let targetPosition = $derived(positionFor(destinationIndex));

	function positionFor(index: number): number {
		const destination = destinations[index] ?? destinations[1];
		return destination.ratio * Math.max(trackWidth - 20, 0);
	}

	function markerPosition(ratio: number): string {
		return `calc(${ratio * 100}% + ${10 - ratio * 20}px)`;
	}

	const captureTrack: Attachment<HTMLDivElement> = (node) => {
		track = node;
		return () => (track = null);
	};

	const captureBody: Attachment<HTMLDivElement> = (node) => {
		body = node;
		return () => (body = null);
	};

	function updateTelemetry(snapshot: SpringToSnapshot): void {
		const state = snapshot.states.x;
		if (!state) return;
		telemetry = {
			position: state.position,
			velocity: state.velocity,
			state: 'moving'
		};
	}

	function moveTo(index: number): void {
		if (!body) return;
		destinationIndex = index;
		const target = positionFor(index);

		if (prefersReducedMotion) {
			gsap.set(body, { x: target });
			telemetry = { position: target, velocity: 0, state: 'reduced' };
			return;
		}

		controller = springTo(body, {
			x: target,
			spring: springPresets.snappy(),
			onUpdate: updateTelemetry,
			onSettle: (snapshot) => {
				const state = snapshot.states.x;
				telemetry = {
					position: state?.position ?? target,
					velocity: state?.velocity ?? 0,
					state: 'settled'
				};
			}
		});
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
			if (body && telemetry.state !== 'moving') {
				const position = positionFor(destinationIndex);
				gsap.set(body, { x: position });
				telemetry = { position, velocity: 0, state: 'ready' };
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
	<Card.Header>
		<Card.Title>Automatic retargeting</Card.Title>
		<Card.Description>
			Choose another target before the spring settles. The next motion inherits its exact position
			and velocity.
		</Card.Description>
		<Card.Action>
			<Badge variant={telemetry.state === 'moving' ? 'default' : 'secondary'}>
				{telemetry.state}
			</Badge>
		</Card.Action>
	</Card.Header>
	<Card.Content>
		<div class="space-y-4">
			<div
				class="relative min-h-32 overflow-hidden rounded-md border border-border bg-muted"
				{@attach captureTrack}
				aria-hidden="true"
			>
				<div class="absolute inset-x-3 top-1/2 border-t border-border"></div>
				{#each destinations as destination (destination.label)}
					<div
						class="absolute bottom-1/2 h-10 border-l border-dashed border-muted-foreground"
						style:left={markerPosition(destination.ratio)}
					></div>
				{/each}
				<div
					class="absolute bottom-1/2 mb-1 size-5 rounded-md border border-primary bg-primary shadow-sm"
					{@attach captureBody}
				></div>
			</div>

			<div class="grid grid-cols-3 gap-2" aria-label="Spring destinations">
				{#each destinations as destination, index (destination.label)}
					<Button
						variant={destinationIndex === index ? 'default' : 'outline'}
						onclick={() => moveTo(index)}
						aria-pressed={destinationIndex === index}
					>
						{destination.label}
					</Button>
				{/each}
			</div>

			<div class="grid grid-cols-3 gap-3 text-muted-foreground">
				<div>
					<p>Position</p>
					<p class="font-mono text-foreground tabular-nums">{telemetry.position.toFixed(1)} px</p>
				</div>
				<div>
					<p>Velocity</p>
					<p class="font-mono text-foreground tabular-nums">{telemetry.velocity.toFixed(1)} px/s</p>
				</div>
				<div>
					<p>Target</p>
					<p class="font-mono text-foreground tabular-nums">{targetPosition.toFixed(1)} px</p>
				</div>
			</div>
		</div>
	</Card.Content>
</Card.Root>
