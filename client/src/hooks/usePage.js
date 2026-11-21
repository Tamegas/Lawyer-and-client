import { useEffect, useState } from 'react';
import { BRAND } from '../lib/brand.js';

/** Sets the browser tab title to "<title> · HaqLink" (screen readers announce route changes through it). */
export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · ${BRAND.name}` : `${BRAND.name} — ${BRAND.tagline}`;
  }, [title]);
}

/** Returns `value` after it has stopped changing for `delay` ms (for search-as-you-type). */
export function useDebounced(value, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}
