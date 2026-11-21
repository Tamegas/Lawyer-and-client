import { Link } from 'react-router-dom';
import { StatusBadge } from '../../components/ui/Badge.jsx';
import { EmptyState, Loadable } from '../../components/ui/Feedback.jsx';
import { PageHeader } from '../../components/ui/Primitives.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useDocumentTitle } from '../../hooks/usePage.js';
import { formatDate, formatMoney } from '../../lib/format.js';
import { quotationStatusForLawyer } from '../../lib/labels.js';

const AWAITING = ['requested', 'revision_requested'];

function Group({ title, items }) {
  if (!items.length) return null;
  return (
    <section className="mb-8"><h2 className="mb-3 text-lg font-semibold">{title}</h2>
      <ul className="space-y-3">{items.map((q) => (
        <li key={q.id}><Link to={`/lawyer/quotations/${q.id}`} className="block rounded-2xl bg-white p-5 shadow-card ring-1 ring-navy-100 hover:shadow-lift">
          <div className="flex flex-wrap items-start justify-between gap-2"><h3 className="text-base font-semibold">{q.client.name}</h3><StatusBadge info={quotationStatusForLawyer(q.status)} /></div>
          <p className="mt-1 line-clamp-2 text-sm text-navy-700">{q.request.scopeNotes}</p>
          <p className="mt-2 text-xs text-navy-600">{q.request.budget != null ? `Client budget ${formatMoney(q.request.budget)} · ` : ''}{q.request.itemizedRequested ? 'Itemised requested · ' : ''}Updated {formatDate(q.updatedAt)}</p></Link></li>))}</ul></section>
  );
}

export default function LawyerQuotations() {
  useDocumentTitle('Fee quotations');
  const { data, loading, error, reload } = useApi('/quotations');
  const list = data?.quotations ?? [];
  return (
    <>
      <PageHeader title="Fee quotations" description="Clients ask for a quotation inside a conversation. Reply with a proposed fee, scope, payment schedule and exclusions. Nobody is obliged to accept a price." />
      <Loadable loading={loading} error={error} onRetry={reload} isEmpty={!list.length} empty={<EmptyState icon="coins" title="No quotation requests yet" description="When a client requests a fee estimate it will appear here." />}>
        <Group title="Needs your proposal" items={list.filter((q) => AWAITING.includes(q.status))} />
        <Group title="Everything else" items={list.filter((q) => !AWAITING.includes(q.status))} />
      </Loadable>
    </>
  );
}
