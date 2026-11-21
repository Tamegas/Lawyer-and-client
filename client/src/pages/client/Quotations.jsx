import { Link, useSearchParams } from 'react-router-dom';
import { StatusBadge } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { EmptyState, Loadable } from '../../components/ui/Feedback.jsx';
import { PageHeader } from '../../components/ui/Primitives.jsx';
import { Tabs } from '../../components/ui/Tabs.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useDocumentTitle } from '../../hooks/usePage.js';
import { formatDate, formatMoney } from '../../lib/format.js';
import { quotationStatusInfo } from '../../lib/labels.js';

const TABS = [{ id: '', label: 'All' }, { id: 'proposed', label: 'Proposal received' }, { id: 'requested', label: 'Waiting' }, { id: 'revision_requested', label: 'Revision requested' }, { id: 'accepted', label: 'Accepted' }, { id: 'declined', label: 'Declined' }];

export default function ClientQuotations() {
  useDocumentTitle('Fee quotations');
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? '';
  const { data, loading, error, reload } = useApi('/quotations', { params: status ? { status } : undefined });
  const list = data?.quotations ?? [];
  return (
    <>
      <PageHeader title="Fee quotations" description="Proposals from lawyers. A quotation is a non-binding proposal that you can accept, decline or ask to change." actions={<Button to="/fee-assistant" variant="secondary">Fee Discussion Assistant</Button>} />
      <Tabs label="Filter by status" tabs={TABS} value={status} onChange={(id) => setParams(id ? { status: id } : {})} idPrefix="cq" className="mb-5" />
      <div role="tabpanel" id="cq-panel" aria-labelledby={`cq-tab-${status}`}>
        <Loadable loading={loading} error={error} onRetry={reload} isEmpty={!list.length}
          empty={<EmptyState icon="coins" title="No quotations here" description="Request a fee estimate from a lawyer’s profile or from a conversation." action={<Button to="/lawyers">Find a lawyer</Button>} />}>
          <ul className="space-y-3">{list.map((q) => (
            <li key={q.id}><Link to={`/client/quotations/${q.id}`} className="block rounded-2xl bg-white p-5 shadow-card ring-1 ring-navy-100 hover:shadow-lift">
              <div className="flex flex-wrap items-start justify-between gap-2"><h2 className="text-lg font-semibold">{q.lawyer.name}</h2><StatusBadge info={quotationStatusInfo(q.status)} /></div>
              <p className="mt-1 line-clamp-2 text-sm text-navy-700">{q.request.scopeNotes}</p>
              <p className="mt-2 text-xs text-navy-600">{q.proposal?.totalEstimate != null ? `Total estimate ${formatMoney(q.proposal.totalEstimate, q.proposal.currency)} · ` : ''}{q.proposal?.validUntil ? `Valid until ${formatDate(q.proposal.validUntil)} · ` : ''}Updated {formatDate(q.updatedAt)}</p></Link></li>))}</ul>
        </Loadable>
      </div>
    </>
  );
}
