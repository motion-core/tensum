<script lang="ts">
	import { createSpring, springPresets } from '@motion-core/spring';
	import { registerMotionCoreSpringPlugin } from '@motion-core/gsap-spring';
	import { PauseIcon, PlayIcon, Refresh01Icon } from '@hugeicons/core-free-icons';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { gsap } from 'gsap';
	import { onDestroy, onMount } from 'svelte';
	import type { Attachment } from 'svelte/attachments';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Slider } from '$lib/components/ui/slider';

	type Segment = { start: number; end: number };

	const handoffTime = 0.35;

	let track = $state<HTMLDivElement | null>(null);
	let body = $state<HTMLDivElement | null>(null);
	let trackWidth = $state(0);
	let currentTime = $state(0);
	let timelineDuration = $state(1);
	let segments = $state<{ a: Segment; b: Segment }>({
		a: { start: 0, end: 0.5 },
		b: { start: handoffTime, end: 1 }
	});
	let status = $state('ready');
	let objectPosition = $state(0);
	let prefersReducedMotion = $state(false);
	let timeline: gsap.core.Timeline | undefined;

	let progress = $derived(timelineDuration === 0 ? 0 : currentTime / timelineDuration);
	let activeOwner = $derived(
		currentTime <= 0 ? 'Ready' : currentTime < segments.b.start ? 'Spring A' : 'Spring B'
	);

	const captureTrack: Attachment<HTMLDivElement> = (node) => {
		track = node;
		return () => (track = null);
	};

	const captureBody: Attachment<HTMLDivElement> = (node) => {
		body = node;
		return () => (body = null);
	};

	function percentage(time: number): number {
		return timelineDuration === 0 ? 0 : (time / timelineDuration) * 100;
	}

	function readPosition(): number {
		if (!body) return 0;
		const value = gsap.getProperty(body, 'x');
		return typeof value === 'number' ? value : Number.parseFloat(String(value)) || 0;
	}

	function syncTimeline(): void {
		if (!timeline) return;
		currentTime = Math.min(timeline.time(), timelineDuration);
		objectPosition = readPosition();
	}

	function buildTimeline(): void {
		if (!body || trackWidth === 0) return;
		timeline?.kill();
		gsap.set(body, { x: 0, rotation: 0 });

		const far = Math.max(trackWidth - 48, 0) * 0.82;
		const near = Math.max(trackWidth - 48, 0) * 0.22;
		const firstParameters = springPresets.snappy();
		const secondParameters = springPresets.bouncy();
		const first = createSpring({ from: 0, to: far, ...firstParameters });
		const handoff = first.stateAt(handoffTime);
		const second = createSpring({
			from: handoff.position,
			to: near,
			velocity: handoff.velocity,
			...secondParameters
		});
		const firstEnd = first.getSettlingDuration();
		const secondEnd = handoffTime + second.getSettlingDuration();
		timelineDuration = Math.max(firstEnd, secondEnd);
		segments = {
			a: { start: 0, end: firstEnd },
			b: { start: handoffTime, end: secondEnd }
		};

		timeline = gsap
			.timeline({
				paused: true,
				onUpdate: syncTimeline,
				onComplete: () => {
					currentTime = timelineDuration;
					objectPosition = readPosition();
					status = 'settled';
				},
				onReverseComplete: () => {
					currentTime = 0;
					objectPosition = 0;
					status = 'ready';
				}
			})
			.to(body, {
				motionSpring: {
					x: far,
					rotation: 8,
					parameters: firstParameters
				}
			})
			.to(
				body,
				{
					motionSpring: {
						x: near,
						rotation: -6,
						parameters: secondParameters
					}
				},
				`<${handoffTime}`
			);

		// Initialize both plugin children so the parent owns their analytical durations.
		timeline.totalTime(timelineDuration, true);
		timeline.totalTime(0, true).pause();
		currentTime = 0;
		objectPosition = 0;
		status = 'ready';
	}

	function play(): void {
		if (!timeline) buildTimeline();
		if (!timeline) return;
		if (prefersReducedMotion) {
			timeline.time(timelineDuration, false).pause();
			syncTimeline();
			status = 'reduced';
			return;
		}
		if (currentTime >= timelineDuration) timeline.time(0, false);
		status = 'playing';
		timeline.play();
	}

	function togglePause(): void {
		if (!timeline || status === 'ready' || status === 'settled') return;
		if (timeline.paused()) {
			status = timeline.reversed() ? 'reversing' : 'playing';
			timeline.resume();
		} else {
			timeline.pause();
			status = 'paused';
		}
	}

	function reverse(): void {
		if (!timeline) buildTimeline();
		if (!timeline) return;
		if (prefersReducedMotion) {
			timeline.time(0, false).pause();
			syncTimeline();
			status = 'reduced';
			return;
		}
		if (currentTime <= 0) timeline.time(timelineDuration, false);
		status = 'reversing';
		timeline.reverse();
	}

	function seek(time: number): void {
		if (!timeline) return;
		timeline.pause().time(time, false);
		syncTimeline();
		status = time <= 0 ? 'ready' : time >= timelineDuration ? 'settled' : 'paused';
	}

	function reset(): void {
		if (!timeline) return;
		timeline.pause().time(0, false);
		syncTimeline();
		status = 'ready';
	}

	onMount(() => {
		registerMotionCoreSpringPlugin(gsap);
		const media = window.matchMedia('(prefers-reduced-motion: reduce)');
		const syncMotionPreference = (): void => {
			prefersReducedMotion = media.matches;
		};
		const resizeObserver = new ResizeObserver((entries) => {
			const entry = entries[0];
			if (!entry) return;
			trackWidth = entry.contentRect.width;
			buildTimeline();
		});

		syncMotionPreference();
		media.addEventListener('change', syncMotionPreference);
		if (track) resizeObserver.observe(track);

		return () => {
			media.removeEventListener('change', syncMotionPreference);
			resizeObserver.disconnect();
		};
	});

	onDestroy(() => timeline?.kill());
</script>

<Card.Root size="sm">
	<Card.Content>
		<div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_19rem]">
			<section class="space-y-3" aria-labelledby="timeline-stage-heading">
				<div class="flex items-start justify-between gap-3">
					<div class="space-y-1">
						<h3 class="font-heading text-sm font-medium" id="timeline-stage-heading">
							Rendered property
						</h3>
						<p class="text-muted-foreground">
							The object is rendered by the same timeline shown beside it.
						</p>
					</div>
					<Badge variant={status === 'playing' || status === 'reversing' ? 'default' : 'secondary'}>
						{activeOwner}
					</Badge>
				</div>

				<div
					class="relative min-h-36 overflow-hidden rounded-md border border-border bg-muted"
					{@attach captureTrack}
					aria-hidden="true"
				>
					<div class="absolute inset-x-6 top-1/2 border-t border-border"></div>
					<div
						class="absolute bottom-1/2 left-[22%] h-12 border-l border-dashed border-muted-foreground"
					></div>
					<div
						class="absolute bottom-1/2 left-[82%] h-12 border-l border-dashed border-muted-foreground"
					></div>
					<div
						class="absolute bottom-1/2 mb-2 h-8 w-12 rounded-md border border-primary bg-primary shadow-sm"
						{@attach captureBody}
					></div>
				</div>

				<div class="flex gap-3 font-mono text-muted-foreground tabular-nums">
					<span>t {currentTime.toFixed(3)} s</span>
					<span>x {objectPosition.toFixed(1)} px</span>
				</div>
			</section>

			<section
				class="space-y-4 lg:border-l lg:border-border lg:pl-4"
				aria-labelledby="timeline-track-heading"
			>
				<div class="space-y-1">
					<h3 class="font-heading text-sm font-medium" id="timeline-track-heading">
						Parent timeline
					</h3>
					<p class="text-muted-foreground">Both bars use their real analytical duration.</p>
				</div>

				<div class="space-y-2">
					<div class="flex justify-between font-mono text-muted-foreground tabular-nums">
						<span>0 s</span>
						<span>{timelineDuration.toFixed(3)} s</span>
					</div>
					<div class="grid grid-cols-[4rem_minmax(0,1fr)] items-center gap-2">
						<span>Spring A</span>
						<div class="relative h-6 overflow-hidden rounded-md bg-muted">
							<div
								class="absolute inset-y-1 rounded-sm bg-primary/25 ring-1 ring-primary/40"
								style:left={`${percentage(segments.a.start)}%`}
								style:width={`${percentage(segments.a.end - segments.a.start)}%`}
							></div>
							<div
								class="absolute inset-y-0 w-px bg-primary"
								style:left={`${progress * 100}%`}
							></div>
						</div>
					</div>
					<div class="grid grid-cols-[4rem_minmax(0,1fr)] items-center gap-2">
						<span>Spring B</span>
						<div class="relative h-6 overflow-hidden rounded-md bg-muted">
							<div
								class="absolute inset-y-1 rounded-sm bg-primary"
								style:left={`${percentage(segments.b.start)}%`}
								style:width={`${percentage(segments.b.end - segments.b.start)}%`}
							></div>
							<div
								class="absolute inset-y-0 w-px bg-primary"
								style:left={`${progress * 100}%`}
							></div>
						</div>
					</div>
				</div>

				<div class="space-y-2">
					<div class="flex items-center justify-between gap-3">
						<label for="timeline-time">Timeline time</label>
						<output class="font-mono text-muted-foreground tabular-nums" for="timeline-time">
							{currentTime.toFixed(3)} s
						</output>
					</div>
					<Slider
						type="single"
						id="timeline-time"
						min={0}
						max={timelineDuration}
						step={0.001}
						value={currentTime}
						aria-label="Timeline time"
						onValueChange={seek}
					/>
				</div>

				<div class="flex flex-wrap gap-2">
					<Button onclick={play}>
						<HugeiconsIcon icon={PlayIcon} strokeWidth={2} data-icon="inline-start" />
						Play
					</Button>
					<Button
						variant="outline"
						size="icon"
						onclick={togglePause}
						disabled={status === 'ready' || status === 'settled'}
						aria-label={status === 'paused' ? 'Resume timeline' : 'Pause timeline'}
					>
						<HugeiconsIcon icon={PauseIcon} strokeWidth={2} />
					</Button>
					<Button variant="outline" onclick={reverse}>Reverse</Button>
					<Button variant="ghost" size="icon" onclick={reset} aria-label="Reset timeline">
						<HugeiconsIcon icon={Refresh01Icon} strokeWidth={2} />
					</Button>
				</div>
			</section>
		</div>
	</Card.Content>
</Card.Root>

<div class="mt-5 grid gap-4 sm:grid-cols-3">
	<div class="space-y-2">
		<Badge variant="outline">automatic handoff</Badge>
		<p class="text-muted-foreground">
			Spring B inherits A's state at exactly {handoffTime.toFixed(2)} s.
		</p>
	</div>
	<div class="space-y-2">
		<Badge variant="outline">seekable</Badge>
		<p class="text-muted-foreground">Drag time to seek both the playhead and rendered property.</p>
	</div>
	<div class="space-y-2">
		<Badge variant="outline">reversible</Badge>
		<p class="text-muted-foreground">Reverse across handoff to restore Spring A as owner.</p>
	</div>
</div>
