<script lang="ts">
	import { onMount } from 'svelte';
	import { ActionTooltip } from '$lib/components/action-tooltip';
	import { IconTransition } from '$lib/components/icon-transition';
	import { Button } from '$lib/components/ui/button';
	import { ThemeIcon } from '$lib/icons';

	const themeStorageKey = 'theme';

	let isDark = $state(true);
	let tooltipLabel = $derived(isDark ? 'Switch to light theme' : 'Switch to dark theme');

	function applyTheme(dark: boolean) {
		isDark = dark;
		document.documentElement.classList.toggle('dark', dark);
	}

	function toggleTheme() {
		const nextIsDark = !isDark;
		applyTheme(nextIsDark);

		try {
			localStorage.setItem(themeStorageKey, nextIsDark ? 'dark' : 'light');
		} catch {
			// The theme still changes when storage is unavailable.
		}
	}

	onMount(() => {
		applyTheme(document.documentElement.classList.contains('dark'));

		function syncTheme(event: StorageEvent) {
			if (event.key === themeStorageKey) {
				applyTheme(event.newValue !== 'light');
			}
		}

		window.addEventListener('storage', syncTheme);
		return () => window.removeEventListener('storage', syncTheme);
	});
</script>

<ActionTooltip content={tooltipLabel} side="bottom">
	{#snippet trigger({ props })}
		<Button
			{...props}
			type="button"
			variant="ghost"
			size="icon-md"
			aria-label="Dark theme"
			aria-pressed={isDark}
			onclick={toggleTheme}
		>
			<span class="theme-icon">
				<IconTransition
					active={isDark}
					inactiveIcon={ThemeIcon}
					activeIcon={ThemeIcon}
					class="size-full"
					iconClass="size-[18px]"
					size={18}
				/>
			</span>
		</Button>
	{/snippet}
</ActionTooltip>

<style>
	.theme-icon {
		display: flex;
		width: 1rem;
		height: 1rem;
		rotate: 0deg;
		transition-property: rotate;
		transition-duration: 180ms;
		transition-timing-function: cubic-bezier(0.2, 0, 0, 1);
	}

	:global(html.dark) .theme-icon {
		rotate: 180deg;
	}

	@media (prefers-reduced-motion: reduce) {
		.theme-icon {
			transition: none;
		}
	}
</style>
