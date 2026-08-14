<script lang="ts">
	import { springPresets } from '@motion-core/spring';
	import { registerMotionCoreSpringPlugin } from '@motion-core/gsap-spring';
	import { PauseIcon, PlayIcon, Refresh01Icon } from '@hugeicons/core-free-icons';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { gsap } from 'gsap';
	import { onDestroy, onMount } from 'svelte';
	import type { Attachment } from 'svelte/attachments';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';

	let track = $state<HTMLDivElement | null>(null);
	let body = $state<HTMLDivElement | null>(null);
	let trackWidth = $state(0);
	let progress = $state(0);
	let status = $state('ready');
	let prefersReducedMotion = $state(false);
	let timeline: gsap.core.Timeline | undefined;
	const timelineSnippet = `gsap.timeline()
  .to(node, {
    motionSpring: {
      x: 520,
      parameters: snappy
    }
  })
  .to(node, {
    motionSpring: {
      x: 120,
      parameters: bouncy
    }
  }, '<0.18')`;

	const captureTrack: Attachment<HTMLDivElement> = (node) => {
		track = node;
		return () => (track = null);
	};

	const captureBody: Attachment<HTMLDivElement> = (node) => {
		body = node;
		return () => (body = null);
	};

	function buildTimeline(): void {
		if (!body || trackWidth === 0) return;
		timeline?.kill();
		gsap.set(body, { x: 0, rotation: 0 });
		progress = 0;
		status = 'ready';

		const far = Math.max(trackWidth - 20, 0) * 0.82;
		const near = Math.max(trackWidth - 20, 0) * 0.22;
		timeline = gsap
			.timeline({
				paused: true,
				onUpdate: () => {
					progress = timeline?.progress() ?? 0;
				},
				onComplete: () => {
					progress = 1;
					status = 'settled';
				}
			})
			.to(body, {
				motionSpring: {
					x: far,
					rotation: 8,
					parameters: springPresets.snappy()
				}
			})
			.to(
				body,
				{
					motionSpring: {
						x: near,
						rotation: -6,
						parameters: springPresets.bouncy()
					}
				},
				'<0.18'
			);
	}

	function play(): void {
		if (!body) return;
		if (prefersReducedMotion) {
			gsap.set(body, { x: Math.max(trackWidth - 20, 0) * 0.22, rotation: -6 });
			progress = 1;
			status = 'reduced';
			return;
		}
		if (!timeline) buildTimeline();
		status = 'playing';
		timeline?.restart();
	}

	function togglePause(): void {
		if (!timeline || status === 'ready' || status === 'settled') return;
		if (timeline.paused()) {
			timeline.resume();
			status = 'playing';
		} else {
			timeline.pause();
			status = 'paused';
		}
	}

	function reset(): void {
		buildTimeline();
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

<Card.Root>
	<Card.Header>
		<Card.Title>Native GSAP composition</Card.Title>
		<Card.Description>
			Two overlapping timeline children target the same property. Ownership and velocity pass at the
			exact timeline time.
		</Card.Description>
		<Card.Action>
			<Badge variant={status === 'playing' ? 'default' : 'secondary'}>{status}</Badge>
		</Card.Action>
	</Card.Header>
	<Card.Content>
		<div class="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
			<div class="space-y-4">
				<div
					class="relative min-h-32 overflow-hidden rounded-md border border-border bg-muted"
					{@attach captureTrack}
					aria-hidden="true"
				>
					<div class="absolute inset-x-3 top-1/2 border-t border-border"></div>
					<div
						class="absolute bottom-1/2 left-[22%] h-10 border-l border-dashed border-muted-foreground"
					></div>
					<div
						class="absolute bottom-1/2 left-[82%] h-10 border-l border-dashed border-muted-foreground"
					></div>
					<div
						class="absolute bottom-1/2 mb-1 size-5 rounded-md border border-primary bg-primary shadow-sm"
						{@attach captureBody}
					></div>
				</div>

				<div class="space-y-2">
					<div class="flex items-center justify-between gap-3 text-muted-foreground">
						<span>Timeline progress</span>
						<span class="font-mono text-foreground tabular-nums">{Math.round(progress * 100)}%</span
						>
					</div>
					<div class="h-1 overflow-hidden rounded-md bg-muted" aria-hidden="true">
						<div class="h-full bg-primary" style:width={`${progress * 100}%`}></div>
					</div>
					<div class="grid grid-cols-2 gap-2 text-muted-foreground">
						<div class="rounded-md border border-border bg-card p-2">
							<p class="text-foreground">Spring A</p>
							<p>0.00 s · x 82%</p>
						</div>
						<div class="rounded-md border border-border bg-card p-2">
							<p class="text-foreground">Spring B</p>
							<p>+0.18 s · x 22%</p>
						</div>
					</div>
				</div>

				<div class="flex flex-wrap gap-2">
					<Button onclick={play}>
						<HugeiconsIcon icon={PlayIcon} strokeWidth={2} data-icon="inline-start" />
						Play sequence
					</Button>
					<Button variant="outline" onclick={togglePause}>
						<HugeiconsIcon icon={PauseIcon} strokeWidth={2} data-icon="inline-start" />
						{status === 'paused' ? 'Resume timeline' : 'Pause timeline'}
					</Button>
					<Button variant="ghost" onclick={reset}>
						<HugeiconsIcon icon={Refresh01Icon} strokeWidth={2} data-icon="inline-start" />
						Reset
					</Button>
				</div>
			</div>

			<div class="overflow-x-auto rounded-md border border-border bg-muted">
				<pre class="p-4 text-xs/relaxed"><code>{timelineSnippet}</code></pre>
			</div>
		</div>
	</Card.Content>
</Card.Root>
