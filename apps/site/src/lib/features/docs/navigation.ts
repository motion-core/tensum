export type DocsNavigationItem = {
	id: string;
	label: string;
	code?: boolean;
};

export type DocsNavigationGroup = {
	label: string;
	items: DocsNavigationItem[];
};

export const docsNavigation: DocsNavigationGroup[] = [
	{
		label: 'Getting started',
		items: [
			{ id: 'overview', label: 'Overview' },
			{ id: 'install', label: 'Install' },
			{ id: 'quick-start', label: 'Quick start' }
		]
	},
	{
		label: 'GSAP',
		items: [
			{ id: 'timelinemotionspring', label: 'timeline.motionSpring()', code: true },
			{ id: 'starting-state', label: 'Starting state' },
			{ id: 'legacy-plugin', label: 'Legacy plugin' },
			{ id: 'springto', label: 'springTo()', code: true }
		]
	},
	{
		label: 'Physics',
		items: [
			{ id: 'parameters', label: 'Parameters' },
			{ id: 'settlement', label: 'Settlement' },
			{ id: 'unsettled-springs', label: 'Unsettled springs' },
			{ id: 'css-linear', label: 'CSS linear()', code: true }
		]
	},
	{
		label: 'Reference',
		items: [
			{ id: 'api-surface', label: 'API surface' },
			{ id: 'lifecycle', label: 'Lifecycle' },
			{ id: 'runtime-support', label: 'Runtime support' }
		]
	}
];

export const docsNavigationItems = docsNavigation.flatMap((group) => group.items);
