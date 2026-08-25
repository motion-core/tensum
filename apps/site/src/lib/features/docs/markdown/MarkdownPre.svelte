<script lang="ts">
	import { CodeBlock } from '$lib/components/code-block';

	let {
		htmlLight,
		htmlDark,
		lang,
		label,
		raw
	}: {
		htmlLight: string;
		htmlDark?: string | undefined;
		lang?: string | undefined;
		label?: string | undefined;
		raw?: string;
	} = $props();
</script>

<CodeBlock
	code={raw ?? ''}
	{htmlLight}
	{htmlDark}
	label={label ?? `${lang ?? 'text'} code example`}
	class="my-7"
/>
