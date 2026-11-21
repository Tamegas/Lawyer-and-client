import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ProposalView } from '../../components/quotes/ProposalView.jsx';
import { StatusBadge } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Alert, Loadable } from '../../components/ui/Feedback.jsx';
import { TextAreaField } from '../../components/ui/Fields.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Card, DescriptionList, PageHeader } from '../../components/ui/Primitives.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useDocumentTitle } from '../../hooks/usePage.js';
import { api, errorMessage } from '../../lib/api.js';
import { formatDate, formatMoney } from '../../lib/format.js';
import { quotationStatusInfo } from '../../lib/labels.js';

const COPY = {
  accept: ['Accept this proposal?', 'This records your agreement in principle. It is not a contract, and nothing is charged by this platform: you and the lawyer still agree the engagement directly.', 'Accept proposal', 'Proposal accepted.'],
  decline: ['Decline this proposal?', 'The lawyer will see that you declined. You can still request another quotation.', 'Decline proposal', 'Proposal declined.'],
  revise: ['Ask for a revision', 'Tell the lawyer what you would like changed, for example the scope, the payment schedule or the total.', 'Send request', 'Revision requested.'],
};

export default function ClientQuotationDetail() {
  const { id } = useParams();
  const toast = useToast();
  const { data, loading, error, reload } = useApi(`/quotations/${id}`);
  const [action, setAction] = useState('');
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const q = data?.quotation;
  useDocumentTitle('Fee quotation');

  const submit = async () => {
    if (busy) return;
    if (action === 'revise' && !note.trim()) { setErr('Tell the lawyer what you would like changed.'); return; }
    setBusy(true); setErr('');
    try { await api.post(`/quotations/${id}/decision`, { decision: action, note: note.trim() || undefined }); toast.success(COPY[action][3]); setAction(''); setNote(''); reload(); }
    catch (e) { setErr(errorMessage(e)); } finally { setBusy(false); }
  };

  return (
    <Loadable loading={loading} error={error} onRetry={reload}>
      {q ? (
        <>
          <PageHeader eyebrow="Fee quotation" title={`Quotation from ${q.lawyer.name}`} actions={<><StatusBadge info={quotationStatusInfo(q.status)} /><Button to={`/messages/${q.conversationId}`} variant="secondary" size="sm" icon="message">Conversation</Button></>} />
          <div className="space-y-6">
            <Card><h2 className="text-lg font-semibold">Your request</h2>
              <DescriptionList className="mt-2" items={[{ label: 'Work to be quoted', value: <span className="whitespace-pre-line">{q.request.scopeNotes}</span> }, { label: 'Your budget', value: q.request.budget != null ? formatMoney(q.request.budget, q.proposal?.currency) : 'Not given' }, { label: 'Itemised', value: q.request.itemizedRequested ? 'Itemised quotation requested' : 'Not requested' }, { label: 'Requested', value: formatDate(q.createdAt) }]} /></Card>
            {q.proposal ? (
              <Card><h2 className="text-lg font-semibold">The lawyer’s proposal</h2><div className="mt-2"><ProposalView proposal={q.proposal} /></div>
                {q.lawyerNote ? <p className="mt-3 rounded-lg bg-navy-50 p-3 text-sm"><strong>Note from the lawyer:</strong> {q.lawyerNote}</p> : null}
                {q.request.budget != null && q.proposal.totalEstimate != null ? <p className="mt-3 text-sm text-navy-700">For reference: your budget was {formatMoney(q.request.budget, q.proposal.currency)} and the lawyer’s estimate is {formatMoney(q.proposal.totalEstimate, q.proposal.currency)}.</p> : null}</Card>
            ) : <Alert tone="info">{q.status === 'declined' ? 'The lawyer declined to quote.' : 'Waiting for the lawyer to send a proposal.'}{q.lawyerNote ? ` Note: ${q.lawyerNote}` : ''}</Alert>}
            {q.clientResponseNote ? <Card><h2 className="text-lg font-semibold">Your response</h2><p className="mt-1 text-sm">{q.clientResponseNote}</p></Card> : null}
            <Alert tone="info" title="What this means">A quotation is a non-binding proposal for discussion. Accepting it records your agreement in principle, not a contract, and this platform charges and collects nothing: there are no online payments. Fees are negotiable only if the lawyer says so.</Alert>
            {q.status === 'proposed' ? <div className="flex flex-wrap gap-3"><Button variant="gold" onClick={() => setAction('accept')}>Accept</Button><Button variant="secondary" onClick={() => setAction('revise')}>Ask for a revision</Button><Button variant="ghost" onClick={() => setAction('decline')}>Decline</Button></div> : null}
            <p className="text-sm"><Link to="/fee-assistant" className="underline">Compare all your quotations</Link></p>
          </div>
          <Modal open={Boolean(action)} onClose={() => { setAction(''); setErr(''); }} title={action ? COPY[action][0] : ''} description={action ? COPY[action][1] : ''}
            footer={<><Button variant="ghost" onClick={() => setAction('')}>Cancel</Button><Button variant={action === 'decline' ? 'danger' : 'primary'} loading={busy} onClick={submit}>{action ? COPY[action][2] : ''}</Button></>}>
            {err ? <Alert tone="danger" className="mb-3">{err}</Alert> : null}
            <TextAreaField label={action === 'revise' ? 'What would you like changed?' : 'Note to the lawyer (optional)'} required={action === 'revise'} rows={4} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
          </Modal>
        </>
      ) : null}
    </Loadable>
  );
}
