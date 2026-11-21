import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { LawyerCard } from '../../components/lawyers/LawyerCard.jsx';
import { StatusBadge } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Alert, Loadable } from '../../components/ui/Feedback.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Card, DescriptionList, PageHeader } from '../../components/ui/Primitives.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useDocumentTitle } from '../../hooks/usePage.js';
import { api, errorMessage } from '../../lib/api.js';
import { formatDate, formatMoney } from '../../lib/format.js';
import { CONSULT_PREFERENCE_LABELS, HELP_TYPE_LABELS, requestStatusInfo } from '../../lib/labels.js';

export default function ClientRequestDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { data, loading, error, reload } = useApi(`/requests/${id}`);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState('');
  const r = data?.request;
  useDocumentTitle(r ? `${r.category.name} request` : 'Request');

  const run = async (key, fn, ok) => {
    if (busy) return;
    setBusy(key);
    try { await fn(); if (ok) toast.success(ok); return true; } catch (err) { toast.error(errorMessage(err)); return false; } finally { setBusy(''); }
  };
  const toggle = () => run('status', async () => { await api.patch(`/requests/${id}`, { status: r.status === 'open' ? 'closed' : 'open' }); reload(); }, r.status === 'open' ? 'Request closed.' : 'Request reopened.');
  const revoke = (s) => run(`rev-${s.conversationId}`, async () => { await api.delete(`/conversations/${s.conversationId}/share-request`); reload(); }, `${s.lawyerName} can no longer read this request.`);
  const remove = async () => { if (await run('delete', () => api.delete(`/requests/${id}`), 'Request deleted.')) navigate('/client/requests', { replace: true }); };

  return (
    <Loadable loading={loading} error={error} onRetry={reload}>
      {r ? (
        <>
          <PageHeader title={r.category.name} eyebrow="Legal request" actions={<><Button variant="secondary" onClick={toggle} loading={busy === 'status'}>{r.status === 'open' ? 'Close request' : 'Reopen request'}</Button><Button variant="danger" onClick={() => setConfirmDelete(true)}>Delete</Button></>} />
          <Card>
            <div className="mb-3"><StatusBadge info={requestStatusInfo(r.status)} /></div>
            <p className="whitespace-pre-line text-sm leading-6 text-navy-900">{r.summary}</p>
            <DescriptionList className="mt-4" items={[
              { label: 'Location', value: r.location?.name }, { label: 'Began', value: r.issueStartedOn && formatDate(r.issueStartedOn) },
              { label: 'Deadline or court date', value: r.hasUrgentDeadline ? (r.deadlineOn ? formatDate(r.deadlineOn) : 'Yes, date not given') : null },
              { label: 'Help needed', value: HELP_TYPE_LABELS[r.helpType] ?? r.helpType }, { label: 'Preferred language', value: r.preferredLanguage },
              { label: 'Consultation method', value: CONSULT_PREFERENCE_LABELS[r.consultationPreference] },
              { label: 'Budget', value: r.budgetMin != null || r.budgetMax != null ? `${r.budgetMin != null ? formatMoney(r.budgetMin, r.currency) : '…'} – ${r.budgetMax != null ? formatMoney(r.budgetMax, r.currency) : '…'}` : null },
              { label: 'Created', value: formatDate(r.createdAt) },
            ]} />
          </Card>

          <section className="mt-8" aria-labelledby="shared-h"><h2 id="shared-h" className="text-xl font-semibold">Who can read this request</h2>
            {data.sharedWith?.length ? (
              <ul className="mt-3 divide-y divide-navy-100 rounded-2xl bg-white p-2 shadow-card ring-1 ring-navy-100">{data.sharedWith.map((s) => (
                <li key={s.conversationId} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm"><span><Link to={`/lawyers/${s.lawyerSlug}`} className="font-medium underline">{s.lawyerName}</Link><span className="block text-xs text-navy-600">Shared {formatDate(s.sharedAt)} · <Link to={`/messages/${s.conversationId}`} className="underline">open conversation</Link></span></span>
                  <Button size="sm" variant="secondary" loading={busy === `rev-${s.conversationId}`} onClick={() => revoke(s)}>Withdraw access</Button></li>))}</ul>
            ) : <Alert className="mt-3" tone="success">Only you. This request has not been shared with any lawyer.</Alert>}
          </section>

          <section className="mt-8" aria-labelledby="match-h"><h2 id="match-h" className="text-xl font-semibold">Possibly relevant professionals</h2>
            <p className="mt-1 text-sm text-navy-700">Suggestions based on your category and preferences. This is not legal advice.</p>
            {data.matches?.length ? <ul className="mt-4 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{data.matches.map((l) => <li key={l.id}><LawyerCard lawyer={l} matchReasons={l.match?.reasons} /></li>)}</ul>
              : <p className="mt-3 text-sm text-navy-700">No published lawyers match this category yet.</p>}
          </section>

          <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete this request?" description="Any lawyer you shared it with will lose access to it. Conversations and their messages are kept."
            footer={<><Button variant="ghost" onClick={() => setConfirmDelete(false)}>Keep it</Button><Button variant="danger" loading={busy === 'delete'} onClick={remove}>Delete request</Button></>}><p className="text-sm">This cannot be undone.</p></Modal>
        </>
      ) : null}
    </Loadable>
  );
}
