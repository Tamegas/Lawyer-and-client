import { createContext, useContext, useMemo } from 'react';
import { useApi } from '../hooks/useApi.js';

const ReferenceContext = createContext(null);

/** Categories, locations, languages and limits from GET /api/reference — loaded once and shared. */
export function ReferenceProvider({ children }) {
  const { data, loading, error, reload } = useApi('/reference');
  const value = useMemo(() => ({ data, loading, error, reload }), [data, loading, error, reload]);
  return <ReferenceContext.Provider value={value}>{children}</ReferenceContext.Provider>;
}

/** -> { data, loading, error, reload } */
export function useReference() {
  const ctx = useContext(ReferenceContext);
  if (!ctx) throw new Error('useReference must be used inside <ReferenceProvider>');
  return ctx;
}

const EMPTY = { categories: [], locations: [], languages: [], helpTypes: [], consultPreferences: [], modes: [], limits: {} };
/** Reference lists plus ready-made option arrays for <SelectField options>: { categories, locations, languages, limits, categoryOptions, locationOptions, languageOptions, loading }. */
export function useReferenceOptions() {
  const { data, loading } = useReference();
  return useMemo(() => {
    const d = { ...EMPTY, ...(data ?? {}) };
    return {
      ...d,
      loading,
      categoryOptions: d.categories.map((c) => ({ value: String(c.id), label: c.name, slug: c.slug })),
      categorySlugOptions: d.categories.map((c) => ({ value: c.slug, label: c.name })),
      locationOptions: d.locations.map((l) => ({ value: String(l.id), label: l.name })),
      languageOptions: d.languages.map((l) => ({ value: l, label: l })),
    };
  }, [data, loading]);
}
