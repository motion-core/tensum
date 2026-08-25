<script lang="ts" module>
	import { type VariantProps, tv } from 'tailwind-variants';
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';

	export const buttonVariants = tv({
		base: "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-md bg-clip-padding text-sm font-medium whitespace-nowrap transition-[color,background-color,background-size,box-shadow] outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
		variants: {
			variant: {
				default:
					'bg-linear-to-b from-primary to-primary-to bg-[length:100%_100%] bg-[bottom] text-primary-foreground shadow-sm inset-shadow-[0_1px_rgb(255_255_255/0.15)] hover:bg-[length:100%_150%]',
				outline:
					'bg-background shadow-[0px_0px_0px_1px_rgba(0,0,0,0.04),0_1px_1px_rgba(0,0,0,0.05),0_2px_2px_rgba(0,0,0,0.05),0_2px_4px_rgba(0,0,0,0.05)] hover:bg-accent hover:text-accent-foreground aria-expanded:bg-accent aria-expanded:text-accent-foreground',
				secondary:
					'bg-background text-foreground shadow-[0px_0px_0px_1px_rgba(0,0,0,0.04),0_1px_1px_rgba(0,0,0,0.05),0_2px_2px_rgba(0,0,0,0.05),0_2px_4px_rgba(0,0,0,0.05)] hover:bg-background/80 aria-expanded:bg-background aria-expanded:text-foreground dark:bg-card/64 dark:inset-shadow-[0_1px_rgb(255_255_255/0.15)] dark:hover:bg-card/80 dark:aria-expanded:bg-card/80',
				ghost:
					'hover:bg-accent hover:text-accent-foreground aria-expanded:bg-accent aria-expanded:text-accent-foreground',
				destructive:
					'text-destructive-foreground bg-destructive shadow-[0px_0px_0px_1px_rgba(0,0,0,0.04),0_1px_1px_rgba(0,0,0,0.05),0_2px_2px_rgba(0,0,0,0.05),0_2px_4px_rgba(0,0,0,0.05)] hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40',
				link: 'text-primary underline-offset-4 hover:underline'
			},
			size: {
				default: 'h-9 px-4 py-2',
				xs: "h-7 gap-1 rounded-sm px-2.5 text-xs [&_svg:not([class*='size-'])]:size-3",
				sm: 'h-8 rounded-md px-3 text-xs',
				lg: 'h-10 rounded-md px-8',
				icon: 'size-9',
				'icon-xs': "size-7 rounded-sm [&_svg:not([class*='size-'])]:size-3",
				'icon-sm': 'size-8 rounded-md',
				'icon-md': 'size-9',
				'icon-lg': 'size-10'
			}
		},
		defaultVariants: {
			variant: 'default',
			size: 'default'
		}
	});

	export type ButtonVariant = VariantProps<typeof buttonVariants>['variant'];
	export type ButtonSize = VariantProps<typeof buttonVariants>['size'];

	export type ButtonProps = WithElementRef<HTMLButtonAttributes> &
		WithElementRef<HTMLAnchorAttributes> & {
			variant?: ButtonVariant;
			size?: ButtonSize;
		};
</script>

<script lang="ts">
	let {
		class: className,
		variant = 'default',
		size = 'default',
		ref = $bindable(null),
		href = undefined,
		type = 'button',
		disabled,
		children,
		...restProps
	}: ButtonProps = $props();
</script>

{#if href}
	<svelte:element
		this={"a"}
		bind:this={ref}
		data-slot="button"
		class={cn(buttonVariants({ variant, size }), className)}
		href={disabled ? undefined : href}
		aria-disabled={disabled}
		role={disabled ? 'link' : undefined}
		tabindex={disabled ? -1 : undefined}
		{...restProps}
	>
		{@render children?.()}
	</svelte:element>
{:else}
	<button
		bind:this={ref}
		data-slot="button"
		class={cn(buttonVariants({ variant, size }), className)}
		{type}
		{disabled}
		{...restProps}
	>
		{@render children?.()}
	</button>
{/if}
