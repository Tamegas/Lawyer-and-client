import { Icon } from './Icon.jsx';

const TONES = {
  neutral: 'bg-navy-100 text-navy-800 ring-navy-200', info: 'bg-sky-50 text-sky-900 ring-sky-200', success: 'bg-emerald-50 text-emerald-900 ring-emerald-200',
  warning: 'bg-amber-50 text-amber-900 ring-amber-200', danger: 'bg-red-50 text-red-900 ring-red-200', gold: 'bg-gold-100 text-gold-900 ring-gold-300',
};
export function Badge({ tone = 'neutral', icon, children, className = '', title }) {
  return (
    <span title={title} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${TONES[tone] ?? TONES.neutral} ${className}`}>
      {icon ? <Icon name={icon} className="h-3.5 w-3.5" /> : null}{children}
    </span>
  );
}
/** <StatusBadge info={verificationInfo(status)} /> — the text is always shown; colour is never the only signal. */
export function StatusBadge({ info, className }) {
  return <Badge tone={info.tone} title={info.hint} className={className} icon={info.tone === 'success' ? 'check' : undefined}>{info.label}</Badge>;
}
