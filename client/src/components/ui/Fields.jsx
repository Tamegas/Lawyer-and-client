import { useId } from 'react';

const INPUT = 'block w-full rounded-lg border-0 bg-white px-3.5 py-2.5 text-[15px] text-navy-950 shadow-sm ring-1 ring-inset placeholder:text-navy-400 focus:ring-2 focus:ring-gold-500 disabled:bg-navy-50 disabled:text-navy-500';
const ring = (error) => (error ? 'ring-red-500' : 'ring-navy-200');

/** Label + hint + error wrapper used by every field. `render(props)` gets { id, 'aria-describedby', 'aria-invalid' }. */
export function FieldShell({ id, label, hint, error, required, className = '', children }) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const describedBy = [hintId, errId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={className}>
      {label ? <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-navy-900">{label}{required ? <span className="ml-0.5 text-red-700" aria-hidden="true">*</span> : null}</label> : null}
      {typeof children === 'function' ? children({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined }) : children}
      {hint ? <p id={hintId} className="mt-1.5 text-xs text-navy-600">{hint}</p> : null}
      {error ? <p id={errId} className="mt-1.5 text-sm font-medium text-red-700" role="alert">{error}</p> : null}
    </div>
  );
}

export function TextField({ label, hint, error, required, id, className = '', inputClassName = '', ...input }) {
  const auto = useId(); const fid = id ?? auto;
  return (
    <FieldShell id={fid} label={label} hint={hint} error={error} required={required} className={className}>
      {(p) => <input {...p} required={required} {...input} className={`${INPUT} ${ring(error)} ${inputClassName}`} />}
    </FieldShell>
  );
}

export function TextAreaField({ label, hint, error, required, id, className = '', maxLength, value, rows = 4, ...input }) {
  const auto = useId(); const fid = id ?? auto;
  return (
    <FieldShell id={fid} label={label} hint={hint} error={error} required={required} className={className}>
      {(p) => (
        <>
          <textarea {...p} rows={rows} value={value} maxLength={maxLength} required={required} {...input} className={`${INPUT} ${ring(error)} resize-y`} />
          {maxLength ? <p className="mt-1 text-right text-xs text-navy-500" aria-hidden="true">{String(value ?? '').length}/{maxLength}</p> : null}
        </>
      )}
    </FieldShell>
  );
}

/** options = [{ value, label }]; `placeholder` adds a first empty option. */
export function SelectField({ label, hint, error, required, id, className = '', options = [], placeholder, value, ...input }) {
  const auto = useId(); const fid = id ?? auto;
  return (
    <FieldShell id={fid} label={label} hint={hint} error={error} required={required} className={className}>
      {(p) => (
        <select {...p} value={value ?? ''} required={required} {...input} className={`${INPUT} ${ring(error)} appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%234a6b9c%22 stroke-width=%222%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[length:1.25rem] bg-[right_0.6rem_center] bg-no-repeat pr-9`}>
          {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
          {options.map((o) => <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>)}
        </select>
      )}
    </FieldShell>
  );
}

export function CheckboxField({ label, hint, error, id, className = '', checked, ...input }) {
  const auto = useId(); const fid = id ?? auto;
  return (
    <div className={className}>
      <div className="flex items-start gap-3">
        <input id={fid} type="checkbox" checked={Boolean(checked)} aria-invalid={error ? true : undefined} aria-describedby={error ? `${fid}-err` : undefined} {...input}
          className="mt-0.5 h-5 w-5 shrink-0 rounded border-navy-300 text-navy-900 focus:ring-2 focus:ring-gold-500" />
        <label htmlFor={fid} className="text-sm leading-5 text-navy-900">{label}{hint ? <span className="mt-0.5 block text-xs text-navy-600">{hint}</span> : null}</label>
      </div>
      {error ? <p id={`${fid}-err`} className="mt-1.5 text-sm font-medium text-red-700" role="alert">{error}</p> : null}
    </div>
  );
}

/** value = array of selected option values; onChange(nextArray). options = [{ value, label }] */
export function CheckboxGroup({ legend, hint, error, options = [], value = [], onChange, className = '', columns = true }) {
  const toggle = (v) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  return (
    <fieldset className={className}>
      {legend ? <legend className="mb-2 text-sm font-medium text-navy-900">{legend}</legend> : null}
      <div className={columns ? 'grid gap-2 sm:grid-cols-2' : 'space-y-2'}>
        {options.map((o) => (
          <label key={o.value} className="flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-1 text-sm text-navy-900">
            <input type="checkbox" checked={value.includes(o.value)} onChange={() => toggle(o.value)} className="h-5 w-5 rounded border-navy-300 text-navy-900 focus:ring-2 focus:ring-gold-500" />{o.label}
          </label>
        ))}
      </div>
      {hint ? <p className="mt-1.5 text-xs text-navy-600">{hint}</p> : null}
      {error ? <p className="mt-1.5 text-sm font-medium text-red-700" role="alert">{error}</p> : null}
    </fieldset>
  );
}

export function RadioGroup({ legend, hint, error, name, options = [], value, onChange, className = '', inline = false }) {
  const auto = useId(); const group = name ?? auto;
  return (
    <fieldset className={className}>
      {legend ? <legend className="mb-2 text-sm font-medium text-navy-900">{legend}</legend> : null}
      <div className={inline ? 'flex flex-wrap gap-x-6 gap-y-1' : 'space-y-1'}>
        {options.map((o) => (
          <label key={o.value} className="flex min-h-10 cursor-pointer items-start gap-3 py-1.5 text-sm text-navy-900">
            <input type="radio" name={group} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="mt-0.5 h-5 w-5 border-navy-300 text-navy-900 focus:ring-2 focus:ring-gold-500" />
            <span>{o.label}{o.hint ? <span className="block text-xs text-navy-600">{o.hint}</span> : null}</span>
          </label>
        ))}
      </div>
      {hint ? <p className="mt-1.5 text-xs text-navy-600">{hint}</p> : null}
      {error ? <p className="mt-1.5 text-sm font-medium text-red-700" role="alert">{error}</p> : null}
    </fieldset>
  );
}
