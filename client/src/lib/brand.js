// "HaqLink" is a PLACEHOLDER working name (haq = "right / justice"). Change it here (and in index.html and
// public/favicon.svg) before launch; nothing else in the client hard-codes the brand.
export const BRAND = {
  name: 'HaqLink',
  tagline: 'Find the right legal support',
  // Set VITE_SUPPORT_EMAIL at build time once a real support inbox exists. Until then the Contact page says
  // plainly that no support channel is configured instead of showing a fake address.
  supportEmail: import.meta.env?.VITE_SUPPORT_EMAIL || '',
  defaultCurrency: 'ETB',
};
