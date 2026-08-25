<script lang="ts">
	import { PageSection, SectionHeader, SectionPanel } from '$lib/components/layout';
	import CapabilityCard from './CapabilityCard.svelte';
	import MomentumIllustration from './illustrations/MomentumIllustration.svelte';
	import OutputsIllustration from './illustrations/OutputsIllustration.svelte';
	import TimelineIllustration from './illustrations/TimelineIllustration.svelte';
</script>

<PageSection id="capabilities" labelledby="capabilities-heading">
	<SectionHeader
		headingId="capabilities-heading"
		title="Motion that stays physically coherent."
		description="The analytical state remains explicit when a target changes, a timeline seeks, or a different render clock samples the spring."
	/>

	<SectionPanel class="grid sm:grid-cols-2">
		<CapabilityCard
			eyebrow="VELOCITY HANDOFF"
			title="Retarget without restarting."
			class="sm:border-e sm:border-border"
		>
			{#snippet visual()}<MomentumIllustration />{/snippet}
			{#snippet description()}
				A newer track inherits the live position and velocity of the property it replaces. Fast
				interruptions stay continuous.
			{/snippet}
		</CapabilityCard>

		<CapabilityCard
			eyebrow="GSAP COMPOSITION"
			title="Let the spring set the duration."
			class="border-t border-border sm:border-t-0"
		>
			{#snippet visual()}<TimelineIllustration />{/snippet}
			{#snippet description()}
				<code class="text-xs text-foreground">timeline.motionSpring()</code> resolves settling before
				GSAP places sequential, staggered, or nested children.
			{/snippet}
		</CapabilityCard>

		<article class="min-w-0 border-t border-border sm:col-span-2">
			<OutputsIllustration />
			<div class="grid min-h-28 gap-3 border-t border-border p-4 sm:grid-cols-5 sm:items-start">
				<div class="sm:col-span-2">
					<p class="font-mono text-xs tracking-wider text-muted-foreground">ONE ANALYTICAL CORE</p>
					<h3 class="mt-1.5 text-base font-medium">The same spring at every output.</h3>
				</div>
				<p class="max-w-xl text-sm leading-relaxed text-pretty text-muted-foreground sm:col-span-3">
					Use one closed-form solution for GSAP playback, direct controllers, deterministic
					keyframes, and CSS <code class="text-xs text-foreground">linear()</code> export. Seeking and
					frame rate do not alter the path.
				</p>
			</div>
		</article>
	</SectionPanel>
</PageSection>
