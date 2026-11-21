import { Icon } from './Icon.jsx';

export function Spinner({ className = 'h-5 w-5' }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
export function Skeleton({ className = 'h-4 w-full' }) {
  return <div className={`animate-pulse rounded-md bg-navy-100 ${className}`} aria-hidden="true" />;
}
export function PageLoader() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-navy-600" role="status">
      <Spinner className="h-8 w-8" /><span className="sr-only">Loading…</span>
    </div>
  );
}

const ALERT = {
  info: ['bg-navy-50 text-navy-900 ring-navy-200', 'info'], success: ['bg-emerald-50 text-emerald-900 ring-emerald-200', 'check'],
  warning: ['bg-amber-50 text-amber-900 ring-amber-200', 'alert'], danger: ['bg-red-50 text-red-900 ring-red-200', 'alert'],
  gold: ['bg-gold-50 text-gold-900 ring-gold-200', 'info'],
};
/** <Alert tone="info|success|warning|danger|gold" title="…" action={<Button/>}>text</Alert> */
export function Alert({ tone = 'info', title, children, action, className = '' }) {
  const [cls, icon] = ALERT[tone] ?? ALERT.info;
  return (
    <div role={tone === 'danger' || tone === 'warning' ? 'alert' : 'status'} className={`flex gap-3 rounded-xl p-4 text-sm ring-1 ${cls} ${className}`}>
      <Icon name={icon} className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="min-w-0 flex-1 space-y-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className="leading-6">{children}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function EmptyState({ icon = 'inbox', title, description, action, className = '' }) {
  return (
    <div className={`flex flex-col items-center rounded-2xl border border-dashed border-navy-200 bg-navy-50/50 px-6 py-12 text-center ${className}`}>
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white text-navy-500 shadow-card"><Icon name={icon} className="h-6 w-6" /></span>
      <h3 className="font-serif text-lg font-semibold text-navy-950">{title}</h3>
      {description ? <p className="mt-1 max-w-md text-sm text-navy-700">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ message = 'Something went wrong while loading this.', onRetry, className = '' }) {
  return (
    <div role="alert" className={`flex flex-col items-center rounded-2xl bg-red-50 px-6 py-10 text-center ring-1 ring-red-200 ${className}`}>
      <Icon name="alert" className="mb-3 h-8 w-8 text-red-700" />
      <p className="max-w-md text-sm text-red-900">{message}</p>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg bg-white px-4 text-sm font-medium text-red-900 ring-1 ring-red-200 hover:bg-red-100">
          <Icon name="refresh" className="h-4 w-4" />Try again
        </button>
      ) : null}
    </div>
  );
}

/** Renders loading / error / empty / content for a fetch: <Loadable loading error onRetry skeleton isEmpty empty>{content}</Loadable> */
export function Loadable({ loading, error, onRetry, skeleton, empty, isEmpty = false, children }) {
  if (loading) return skeleton ?? <PageLoader />;
  if (error) return <ErrorState message={error.message} onRetry={onRetry} />;
  if (isEmpty) return empty ?? null;
  return children;
}
