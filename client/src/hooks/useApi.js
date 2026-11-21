import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';

/**
 * GET a path and keep { data, error, loading }.
 *   const { data, error, loading, reload, setData } = useApi('/lawyers', { params: { q }, enabled: true });
 * Re-fetches when `path` or `params` change (params are compared by value); cancels in-flight requests.
 */
export function useApi(path, { params, enabled = true } = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: Boolean(enabled && path) });
  const [tick, setTick] = useState(0);
  const key = JSON.stringify(params ?? null);
  const alive = useRef(true);

  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  useEffect(() => {
    if (!enabled || !path) { setState((s) => (s.loading ? { ...s, loading: false } : s)); return undefined; }
    const ctrl = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null }));
    api.get(path, { query: params, signal: ctrl.signal })
      .then((data) => { if (alive.current && !ctrl.signal.aborted) setState({ data, error: null, loading: false }); })
      .catch((error) => { if (error?.name !== 'AbortError' && alive.current && !ctrl.signal.aborted) setState((s) => ({ data: s.data, error, loading: false })); });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, key, enabled, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  const setData = useCallback((updater) => setState((s) => ({ ...s, data: typeof updater === 'function' ? updater(s.data) : updater })), []);
  return { ...state, reload, setData };
}
