import { createHighlighterCoreSync } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';
import bash from 'shiki/langs/bash.mjs';
import typescript from 'shiki/langs/typescript.mjs';
import githubDark from 'shiki/themes/github-dark.mjs';
import githubLight from 'shiki/themes/github-light.mjs';

let highlighter: ReturnType<typeof createHighlighterCoreSync> | null = null;

export function getHighlighter() {
	highlighter ??= createHighlighterCoreSync({
		themes: [githubLight, githubDark],
		langs: [typescript, bash],
		engine: createJavaScriptRegexEngine()
	});

	return highlighter;
}
