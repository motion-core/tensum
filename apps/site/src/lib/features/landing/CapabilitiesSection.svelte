<script lang="ts">
	import { ActionTooltip } from '$lib/components/action-tooltip';
	import { IconTransition } from '$lib/components/icon-transition';
	import { PageSection, SectionHeader, SectionPanel } from '$lib/components/layout';
	import { Button } from '$lib/components/ui/button';
	import { PauseIcon, PlayIcon } from '$lib/icons';
	import CapabilityCard from './CapabilityCard.svelte';
	import MomentumIllustration from './illustrations/MomentumIllustration.svelte';
	import OutputsIllustration from './illustrations/OutputsIllustration.svelte';
	import TimelineIllustration from './illustrations/TimelineIllustration.svelte';

	let animationsPaused = $state(false);
	let animationAnnouncement = $state('');
	let animationAction = $derived(
		animationsPaused ? 'Resume capability illustrations' : 'Pause capability illustrations'
	);

	function toggleAnimations() {
		animationsPaused = !animationsPaused;
		animationAnnouncement = animationsPaused
			? 'Capability illustrations paused.'
			: 'Capability illustrations resumed.';
	}
</script>

<PageSection id="capabilities" labelledby="capabilities-heading">
	<SectionHeader
		headingId="capabilities-heading"
		title="Motion that stays physically coherent."
		description="The analytical state remains explicit when a target changes, a timeline seeks, or a different render clock samples the spring."
	/>

	<SectionPanel class="relative grid sm:grid-cols-2">
		<div class="absolute top-3 right-3 z-30">
			<ActionTooltip content={animationAction}>
				{#snippet trigger({ props })}
					<Button
						{...props}
						type="button"
						variant="ghost"
						size="icon-xs"
						aria-label={animationAction}
						onclick={toggleAnimations}
					>
						<IconTransition
							active={animationsPaused}
							inactiveIcon={PauseIcon}
							activeIcon={PlayIcon}
						/>
					</Button>
				{/snippet}
			</ActionTooltip>
		</div>
		<span class="sr-only" role="status" aria-atomic="true">{animationAnnouncement}</span>

		<CapabilityCard
			eyebrow="VELOCITY HANDOFF"
			title="Retarget without restarting."
			class="sm:border-e sm:border-border/64 dark:sm:border-card/80"
		>
			{#snippet visual()}<MomentumIllustration paused={animationsPaused} />{/snippet}
			{#snippet description()}
				A newer track inherits the live position and velocity of the property it replaces. Fast
				interruptions stay continuous.
			{/snippet}
		</CapabilityCard>

		<CapabilityCard
			eyebrow="GSAP COMPOSITION"
			title="Let the spring set the duration."
			class="border-t border-border/64 sm:border-t-0 dark:border-card/80"
		>
			{#snippet visual()}<TimelineIllustration paused={animationsPaused} />{/snippet}
			{#snippet description()}
				<code class="font-mono text-sm text-foreground">timeline.motionSpring()</code> resolves settling
				before GSAP places sequential, staggered, or nested children.
			{/snippet}
		</CapabilityCard>

		<article class="min-w-0 border-t border-border/64 sm:col-span-2 dark:border-card/80">
			<OutputsIllustration paused={animationsPaused} />
			<div
				class="grid min-h-32 gap-6 border-t border-border/64 p-6 sm:grid-cols-5 sm:items-start dark:border-card/80"
			>
				<div class="sm:col-span-2">
					<p class="font-mono text-xs text-muted-foreground">ONE ANALYTICAL CORE</p>
					<h3 class="mt-2 text-lg font-semibold">The same spring at every output.</h3>
				</div>
				<p class="max-w-xl text-sm leading-relaxed text-pretty text-muted-foreground sm:col-span-3">
					Use one closed-form solution for GSAP playback, direct controllers, deterministic
					keyframes, and CSS <code class="font-mono text-sm text-foreground">linear()</code> export. Seeking
					and frame rate do not alter the path.
				</p>
			</div>
		</article>
	</SectionPanel>
</PageSection>
