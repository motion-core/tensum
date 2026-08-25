// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

declare module '*.svx' {
	import type { Component } from 'svelte';
	export const metadata: Record<string, unknown>;
	const component: Component<Record<string, unknown>>;
	export default component;
}

export {};
