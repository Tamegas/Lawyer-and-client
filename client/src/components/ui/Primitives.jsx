import { Icon } from './Icon.jsx';

export function Container({ className = '', narrow = false, children, as: Tag = 'div' }) {
  return <Tag className={`mx-auto w-full px-4 sm:px-6 lg:px-8 ${narrow ? 'max-w-3xl' : 'max-w-7xl'} ${className}`}>{children}</Tag>;
}
export function Card({ className = '', padding = 'p-5 sm:p-6', as: Tag = 'div', children, ...rest }) {
  return <Tag className={`rounded-2xl bg-white shadow-card ring-1 ring-navy-100 ${padding} ${className}`} {...rest}>{children}</Tag>;
}
const SECTION_TONES = { default: 'bg-white', muted: 'bg-navy-50/70', navy: 'bg-navy-950 text-white' };
export function Section({ tone = 'default', className = '', id, children }) {
  return <section id={id} className={`py-14 sm:py-20 ${SECTION_TONES[tone]} ${className}`}><Container>{children}</Container></section>;
}
export function SectionHeading({ eyebrow, title, description, align = 'left', tone = 'default', as: Tag = 'h2' }) {
  const dark = tone === 'dark';
  return (
    <div className={`mb-8 max-w-2xl sm:mb-10 ${align === 'center' ? 'mx-auto text-center' : ''}`}>
      {eyebrow ? <p className={`mb-2 text-xs font-semibold uppercase tracking-[0.16em] ${dark ? 'text-gold-300' : 'text-gold-700'}`}>{eyebrow}</p> : null}
      <Tag className={`text-3xl font-semibold sm:text-4xl ${dark ? '!text-white' : ''}`}>{title}</Tag>
      {description ? <p className={`mt-3 text-base leading-7 ${dark ? 'text-navy-200' : 'text-navy-700'}`}>{description}</p> : null}
    </div>
  );
}
/** The page's <h1>. actions = buttons shown to the right. */
export function PageHeader({ title, description, eyebrow, actions, className = '' }) {
  return (
    <header className={`mb-6 flex flex-wrap items-end justify-between gap-4 ${className}`}>
      <div className="min-w-0">
        {eyebrow ? <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-gold-700">{eyebrow}</p> : null}
        <h1 className="text-2xl font-semibold sm:text-3xl">{title}</h1>
        {description ? <p className="mt-1.5 max-w-2xl text-sm leading-6 text-navy-700">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}
/** items = [{ label, value }] — rows with null/'' values are skipped. */
export function DescriptionList({ items, className = '' }) {
  return (
    <dl className={`divide-y divide-navy-100 text-sm ${className}`}>
      {items.filter((i) => i.value !== null && i.value !== undefined && i.value !== '').map((i) => (
        <div key={i.label} className="grid gap-1 py-2.5 sm:grid-cols-3 sm:gap-4">
          <dt className="font-medium text-navy-600">{i.label}</dt>
          <dd className="text-navy-950 sm:col-span-2">{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}
export function Stat({ label, value, hint, icon }) {
  return (
    <Card padding="p-4 sm:p-5">
      <div className="flex items-center justify-between text-navy-600"><span className="text-sm font-medium">{label}</span>{icon ? <Icon name={icon} className="h-5 w-5 text-gold-600" /> : null}</div>
      <p className="mt-2 font-serif text-3xl font-semibold text-navy-950">{value}</p>
      {hint ? <p className="mt-1 text-xs text-navy-600">{hint}</p> : null}
    </Card>
  );
}
