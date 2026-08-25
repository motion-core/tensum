<script lang="ts">
	import { CodeBlock } from '$lib/components/code-block';
	import { PageSection, SectionHeader, SectionPanel } from '$lib/components/layout';

	type Props = {
		installCommand: string;
		setupCode: string;
		commandHtmlLight: string;
		commandHtmlDark: string;
		htmlLight: string;
		htmlDark: string;
	};

	let { installCommand, setupCode, commandHtmlLight, commandHtmlDark, htmlLight, htmlDark }: Props =
		$props();
</script>

<PageSection id="get-started" labelledby="get-started-heading">
	<SectionHeader
		headingId="get-started-heading"
		title="Install once. Compose on the timeline."
		description="Add the package beside GSAP, register the plugin once, and let the spring derive its own timing."
	/>

	<SectionPanel class="grid lg:grid-cols-5">
		<div class="flex flex-col border-b border-border p-3 lg:col-span-2 lg:border-e lg:border-b-0">
			<div>
				<p class="text-sm font-medium">1. Install the package</p>
				<CodeBlock
					code={installCommand}
					htmlLight={commandHtmlLight}
					htmlDark={commandHtmlDark}
					label="Package installation command"
					lineNumbers={false}
					compact
					class="mt-2"
				/>
				<p class="mt-2 text-xs leading-relaxed text-muted-foreground">
					GSAP is a peer dependency, so the application and plugin share one timeline instance.
				</p>
			</div>

			<div class="mt-6 border-t border-border pt-4 lg:mt-auto">
				<p class="text-sm font-medium">2. Register and compose</p>
				<p class="mt-1.5 text-xs leading-relaxed text-muted-foreground">
					The effect resolves duration before GSAP inserts the tween.
				</p>
			</div>
		</div>

		<div class="min-w-0 lg:col-span-3">
			<CodeBlock
				code={setupCode}
				{htmlLight}
				{htmlDark}
				label="GSAP spring setup example"
				framed={false}
				class="h-full"
			/>
		</div>
	</SectionPanel>
</PageSection>
