import { useId } from 'react';
import { Icon } from './Icon.jsx';

/** Read-only rating: <Stars value={4.5} count={12} size="md" /> */
export function Stars({ value = 0, count, size = 'md', className = '' }) {
  const px = size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-6 w-6' : 'h-5 w-5';
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`} role="img" aria-label={`${value} out of 5 stars${count != null ? `, ${count} review${count === 1 ? '' : 's'}` : ''}`}>
      <span className="inline-flex">
        {[1, 2, 3, 4, 5].map((n) => {
          const fill = Math.max(0, Math.min(1, value - (n - 1)));
          return (
            <span key={n} className={`relative inline-block ${px}`}>
              <Icon name="star" className={`absolute inset-0 ${px} text-navy-200`} />
              <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}><Icon name="star" className={`${px} fill-gold-400 text-gold-500`} /></span>
            </span>
          );
        })}
      </span>
      {count != null ? <span className="text-sm text-navy-700">{Number(value).toFixed(1)} ({count})</span> : null}
    </span>
  );
}

/** Rating input (radio group, arrow keys work natively): <StarInput value onChange label error /> */
export function StarInput({ value = 0, onChange, label = 'Your rating', error }) {
  const name = useId();
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium text-navy-900">{label}</legend>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className="cursor-pointer rounded p-1 focus-within:ring-2 focus-within:ring-gold-500">
            <input type="radio" name={name} value={n} checked={value === n} onChange={() => onChange(n)} className="sr-only" />
            <span className="sr-only">{n} star{n === 1 ? '' : 's'}</span>
            <Icon name="star" className={`h-8 w-8 ${n <= value ? 'fill-gold-400 text-gold-500' : 'text-navy-300'}`} />
          </label>
        ))}
      </div>
      {error ? <p className="mt-1.5 text-sm font-medium text-red-700" role="alert">{error}</p> : null}
    </fieldset>
  );
}
