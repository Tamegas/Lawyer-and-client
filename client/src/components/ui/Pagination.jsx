import { Icon } from './Icon.jsx';

/** <Pagination page pageSize total onPageChange /> — renders nothing when everything fits on one page. */
export function Pagination({ page, pageSize, total, onPageChange }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const items = [];
  for (let p = 1; p <= pages; p += 1) if (p === 1 || p === pages || Math.abs(p - page) <= 1) items.push(p);
  const withGaps = items.flatMap((p, i) => (i > 0 && p - items[i - 1] > 1 ? ['…', p] : [p]));
  const btn = 'inline-flex h-10 min-w-10 items-center justify-center rounded-lg px-3 text-sm font-medium';
  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-center gap-1.5">
      <button type="button" className={`${btn} text-navy-800 ring-1 ring-navy-200 hover:bg-navy-50 disabled:opacity-40`} disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label="Previous page"><Icon name="arrow-left" className="h-4 w-4" /></button>
      {withGaps.map((p, i) => (p === '…'
        ? <span key={`g${i}`} className="px-1 text-navy-500" aria-hidden="true">…</span>
        : <button key={p} type="button" onClick={() => onPageChange(p)} aria-current={p === page ? 'page' : undefined} aria-label={`Page ${p}`}
            className={`${btn} ${p === page ? 'bg-navy-900 text-white' : 'text-navy-800 ring-1 ring-navy-200 hover:bg-navy-50'}`}>{p}</button>))}
      <button type="button" className={`${btn} text-navy-800 ring-1 ring-navy-200 hover:bg-navy-50 disabled:opacity-40`} disabled={page >= pages} onClick={() => onPageChange(page + 1)} aria-label="Next page"><Icon name="arrow-right" className="h-4 w-4" /></button>
    </nav>
  );
}
