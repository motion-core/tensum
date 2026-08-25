import { getHighlighter } from '$lib/server/highlighter';

import type { PageServerLoad } from './$types';

const setupCode = `import { gsap } from 'gsap';
import { SpringPlugin, springPresets } from '@motion-core/spring';

gsap.registerPlugin(SpringPlugin);

gsap.timeline().motionSpring(card, {
  x: 320,
  from: { x: 0 },
  parameters: springPresets.snappy()
});`;
const installCommand = 'pnpm add @motion-core/spring gsap';

export const load: PageServerLoad = () => {
	const highlighter = getHighlighter();

	return {
		installationCommand: {
			raw: installCommand,
			light: highlighter.codeToHtml(installCommand, {
				lang: 'bash',
				theme: 'github-light',
				tabindex: false
			}),
			dark: highlighter.codeToHtml(installCommand, {
				lang: 'bash',
				theme: 'github-dark',
				tabindex: false
			})
		},
		installationCode: {
			raw: setupCode,
			light: highlighter.codeToHtml(setupCode, {
				lang: 'typescript',
				theme: 'github-light',
				tabindex: false
			}),
			dark: highlighter.codeToHtml(setupCode, {
				lang: 'typescript',
				theme: 'github-dark',
				tabindex: false
			})
		}
	};
};
