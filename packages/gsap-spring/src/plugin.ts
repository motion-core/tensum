/**
 * A real GSAP special-property plugin remains experimental. The initial API is
 * deliberately `springTo()`, which can compute duration before constructing
 * the GSAP tween and therefore keeps duration out of the public configuration.
 */
export const realSpringPluginStatus = Object.freeze({
  api: 'springTo',
  status: 'experimental',
  reason: 'The clock adapter is the validated integration boundary for the first iteration.',
} as const);
