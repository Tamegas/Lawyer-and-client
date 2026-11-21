import { useRef } from 'react';

/**
 * <Tabs label="Sections" tabs={[{ id, label, count? }]} value onChange />  — render the panel yourself with
 * <div role="tabpanel" id={`${idPrefix}-panel`} aria-labelledby={`${idPrefix}-tab-${value}`}>…</div>.
 */
export function Tabs({ tabs, value, onChange, label = 'Sections', idPrefix = 'tabs', className = '' }) {
  const refs = useRef({});
  const onKey = (e, i) => {
    const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!dir && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (i + dir + tabs.length) % tabs.length;
    onChange(tabs[next].id);
    refs.current[tabs[next].id]?.focus();
  };
  return (
    <div role="tablist" aria-label={label} className={`flex gap-1 overflow-x-auto border-b border-navy-200 ${className}`}>
      {tabs.map((t, i) => {
        const active = t.id === value;
        return (
          <button key={t.id} ref={(el) => { refs.current[t.id] = el; }} type="button" role="tab" id={`${idPrefix}-tab-${t.id}`} aria-selected={active} aria-controls={`${idPrefix}-panel`}
            tabIndex={active ? 0 : -1} onClick={() => onChange(t.id)} onKeyDown={(e) => onKey(e, i)}
            className={`-mb-px shrink-0 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${active ? 'border-gold-500 text-navy-950' : 'border-transparent text-navy-600 hover:border-navy-200 hover:text-navy-900'}`}>
            {t.label}{t.count != null ? <span className="ml-2 rounded-full bg-navy-100 px-2 py-0.5 text-xs">{t.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
