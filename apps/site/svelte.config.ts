import { fileURLToPath, URL } from 'node:url';
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { escapeSvelte, mdsvex } from 'mdsvex';
import rehypeSlug from 'rehype-slug';
import { createHighlighter } from 'shiki';
import type { Config } from '@sveltejs/kit';

const themes = {
	light: 'github-light',
	dark: 'github-dark'
} as const;

const languages = ['bash', 'typescript', 'javascript', 'json', 'css', 'html', 'text'] as const;
const languageAliases: Record<string, (typeof languages)[number]> = {
	js: 'javascript',
	sh: 'bash',
	shell: 'bash',
	ts: 'typescript'
};

const highlighter = await createHighlighter({
	themes: Object.values(themes),
	langs: [...languages]
});

const markdownLayout = fileURLToPath(
	new URL('./src/lib/features/docs/MarkdownLayout.svelte', import.meta.url)
);

const config: Config = {
	extensions: ['.svelte', '.svx'],
	compilerOptions: {
		// mdsvex emits a legacy-compatible wrapper; regular project components use runes.
		runes: ({ filename }) =>
			filename.endsWith('.svx') || filename.split(/[/\\]/).includes('node_modules')
				? undefined
				: true
	},
	preprocess: [
		mdsvex({
			extensions: ['.svx'],
			layout: {
				_: markdownLayout
			},
			rehypePlugins: [rehypeSlug],
			highlight: {
				highlighter: (code, lang) => {
					const requestedLanguage = languageAliases[lang ?? ''] ?? lang ?? 'text';
					const safeLanguage = languages.includes(requestedLanguage as (typeof languages)[number])
						? (requestedLanguage as (typeof languages)[number])
						: 'text';
					const lightHtml = escapeSvelte(
						highlighter.codeToHtml(code, {
							lang: safeLanguage,
							theme: themes.light,
							tabindex: false
						})
					);
					const darkHtml = escapeSvelte(
						highlighter.codeToHtml(code, {
							lang: safeLanguage,
							theme: themes.dark,
							tabindex: false
						})
					);

					return `<svelte:component this={Reflect.get(globalThis, "__SpringMarkdownPre")} lang={${JSON.stringify(
						lang
					)}} htmlLight={${JSON.stringify(lightHtml)}} htmlDark={${JSON.stringify(
						darkHtml
					)}} raw={${JSON.stringify(code)}} />`;
				}
			}
		}),
		vitePreprocess()
	],
	kit: {
		adapter: adapter()
	}
};

export default config;
