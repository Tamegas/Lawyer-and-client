import { Link } from 'react-router-dom';
import { Badge, StatusBadge } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { EmptyState, Loadable } from '../../components/ui/Feedback.jsx';
import { PageHeader } from '../../components/ui/Primitives.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useDocumentTitle } from '../../hooks/usePage.js';
import { formatDate } from '../../lib/format.js';
import { requestStatusInfo } from '../../lib/labels.js';

export default function ClientRequests() {
  useDocumentTitle('My legal requests');
  const { data, loading, error, reload } = useApi('/requests');
  const list = data?.requests ?? [];
  return (
    <>
      <PageHeader title="My legal requests" description="Your private requests. A lawyer sees one only after you choose to share it with them." actions={<Button to="/describe-problem" variant="gold" icon="plus">New request</Button>} />
      <Loadable loading={loading} error={error} onRetry={reload} isEmpty={!list.length}
        empty={<EmptyState icon="file-text" title="No requests yet" description="Describe your legal problem to get a list of professionals who may be relevant." action={<Button to="/describe-problem">Describe my legal problem</Button>} />}>
        <ul className="space-y-3">{list.map((r) => (
          <li key={r.id}><Link to={`/client/requests/${r.id}`} className="block rounded-2xl bg-white p-5 shadow-card ring-1 ring-navy-100 transition hover:shadow-lift">
            <div className="flex flex-wrap items-start justify-between gap-2"><h2 className="text-lg font-semibold">{r.category.name}</h2>
              <span className="flex flex-wrap gap-2">{r.hasUrgentDeadline ? <Badge tone="warning">Deadline{r.deadlineOn ? `: ${formatDate(r.deadlineOn)}` : ''}</Badge> : null}<StatusBadge info={requestStatusInfo(r.status)} /></span></div>
            <p className="mt-1 line-clamp-2 text-sm text-navy-700">{r.summary}</p>
            <p className="mt-2 text-xs text-navy-600">{r.location?.name ? `${r.location.name} · ` : ''}Created {formatDate(r.createdAt)}</p></Link></li>))}</ul>
      </Loadable>
    </>
  );
}
