import { useCallback, useState } from 'react';

/**
 * Controlled form state.
 *   const form = useForm({ email: '', agree: false });
 *   <TextField label="Email" {...form.bind('email')} />      // bind -> { value, onChange, error }; onChange takes an event OR a raw value
 *   form.values · form.errors · form.setValue(name, value) · form.setValues(partial) · form.setErrors(obj) · form.reset(next?) · form.dirty
 *   catch (err) { if (!form.applyError(err)) toast.error(errorMessage(err)); }   // applyError puts API `fields` into form.errors, returns true if it did
 */
export function useForm(initial) {
  const [base, setBase] = useState(initial);
  const [values, setAll] = useState(initial);
  const [errors, setErrors] = useState({});

  const setValue = useCallback((name, value) => {
    setAll((v) => ({ ...v, [name]: value }));
    setErrors((e) => (e[name] ? { ...e, [name]: undefined } : e));
  }, []);
  const setValues = useCallback((partial) => setAll((v) => ({ ...v, ...partial })), []);
  const bind = (name) => ({
    value: values[name],
    error: errors[name],
    onChange: (e) => {
      const t = e?.target;
      setValue(name, t ? (t.type === 'checkbox' ? t.checked : t.value) : e);
    },
  });
  const applyError = useCallback((err) => {
    if (err?.fields && Object.keys(err.fields).length) { setErrors(err.fields); return true; }
    return false;
  }, []);
  const reset = useCallback((next) => { const n = next ?? base; setBase(n); setAll(n); setErrors({}); }, [base]);
  const dirty = JSON.stringify(values) !== JSON.stringify(base);
  return { values, errors, setValue, setValues, setErrors, bind, applyError, reset, dirty };
}
