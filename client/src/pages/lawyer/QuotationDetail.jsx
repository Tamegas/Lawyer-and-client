import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ProposalView } from '../../components/quotes/ProposalView.jsx';
import { StatusBadge } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Alert, Loadable } from '../../components/ui/Feedback.jsx';
import { RadioGroup, TextAreaField, TextField } from '../../components/ui/Fields.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Card, DescriptionList, PageHeader } from '../../components/ui/Primitives.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useDocumentTitle } from '../../hooks/usePage.js';
import { api, errorMessage } from '../../lib/api.js';
import { formatDate, formatMoney, todayIso } from '../../lib/format.js';
import { FEE_TYPE_LABELS, quotationStatusForLawyer } from '../../lib/labels.js';

const EMPTY = { feeType: 'fixed', fixedAmount: '', hourlyRate: '', estimatedHours: '', items: [{ description: '', amount: '' }], scopeOfWork: '', paymentSchedule: '', exclusions: '', expensesNote: '', validUntil: '', lawyerNote: '' };
const n = (v) => (v === '' || v == null ? null : Number(v));
// Preview only: the server recomputes the total and is the authority.
function preview(f) {
  if (f.feeType === 'fixed') return n(f.fixedAmount);
  if (f.feeType === 'hourly') return n(f.hourlyRate) != null && n(f.estimatedHours) != null ? Math.round(n(f.hourlyRate) * n(f.estimatedHours) * 100) / 100 : null;
  const items = f.items.filter((i) => n(i.amount) != null);
  return items.length ? Math.round(items.reduce((s, i) => s + Number(i.amount), 0) * 100) / 100 : null;
}

function ProposalForm({ q, onDone }) {
  const toast = useToast();
  const [f, setF] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (q.proposal) setF({ ...EMPTY, feeType: q.proposal.feeType, fixedAmount: q.proposal.fixedAmount ?? '', hourlyRate: q.proposal.hourlyRate ?? '', estimatedHours: q.proposal.estimatedHours ?? '', items: q.proposal.items?.length ? q.proposal.items.map((i) => ({ description: i.description, amount: i.amount })) : EMPTY.items, scopeOfWork: q.proposal.scopeOfWork ?? '', paymentSchedule: q.proposal.paymentSchedule ?? '', exclusions: q.proposal.exclusions ?? '', expensesNote: q.proposal.expensesNote ?? '', validUntil: q.proposal.validUntil ?? '' });
  }, [q.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const total = useMemo(() => preview(f), [f]);
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setErrors((x) => ({ ...x, [k]: undefined })); };
  const setItem = (i, k, v) => setF({ ...f, items: f.items.map((it, j) => (j === i ? { ...it, [k]: v } : it)) });

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    const items = f.items.filter((i) => i.description.trim() || i.amount !== '').map((i) => ({ description: i.description.trim(), amount: Number(i.amount) }));
    const errs = {};
    if (f.scopeOfWork.trim().length < 10) errs.scopeOfWork = 'Describe the scope of work (at least 10 characters)';
    if (f.feeType === 'fixed' && n(f.fixedAmount) == null) errs.fixedAmount = 'Enter the fixed amount';
    if (f.feeType === 'hourly' && n(f.hourlyRate) == null) errs.hourlyRate = 'Enter the hourly rate';
    if ((f.feeType === 'itemized' || q.request.itemizedRequested) && !items.length) errs.items = 'Add at least one item';
    if (f.validUntil && f.validUntil < todayIso()) errs.validUntil = 'The validity date cannot be in the past';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true); setNote('');
    try {
      await api.post(`/quotations/${q.id}/respond`, { feeType: f.feeType, fixedAmount: f.feeType === 'fixed' ? n(f.fixedAmount) : null, hourlyRate: f.feeType === 'hourly' ? n(f.hourlyRate) : null, estimatedHours: f.feeType === 'hourly' ? n(f.estimatedHours) : null, items, scopeOfWork: f.scopeOfWork.trim(), paymentSchedule: f.paymentSchedule.trim(), exclusions: f.exclusions.trim(), expensesNote: f.expensesNote.trim(), validUntil: f.validUntil, lawyerNote: f.lawyerNote.trim() });
      toast.success('Proposal sent to the client.');
      onDone();
    } catch (err) { if (err?.fields) setErrors(err.fields); else setNote(errorMessage(err)); } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      {note ? <Alert tone="danger">{note}</Alert> : null}
      <RadioGroup legend="Fee type" name="feeType" inline value={f.feeType} onChange={(v) => setF({ ...f, feeType: v })} options={Object.entries(FEE_TYPE_LABELS).map(([value, label]) => ({ value, label }))} />
      {f.feeType === 'fixed' ? <TextField label="Fixed amount (ETB)" type="number" min="0" step="0.01" required value={f.fixedAmount} error={errors.fixedAmount} onChange={set('fixedAmount')} /> : null}
      {f.feeType === 'hourly' ? <div className="grid gap-4 sm:grid-cols-2"><TextField label="Hourly rate (ETB)" type="number" min="0" step="0.01" required value={f.hourlyRate} error={errors.hourlyRate} onChange={set('hourlyRate')} /><TextField label="Estimated hours (optional)" type="number" min="0" step="0.5" value={f.estimatedHours} error={errors.estimatedHours} onChange={set('estimatedHours')} /></div> : null}
      <fieldset><legend className="mb-1 text-sm font-medium">Itemised fees{f.feeType === 'itemized' || q.request.itemizedRequested ? ' (required)' : ' (optional breakdown)'}</legend>
        <ul className="space-y-2">{f.items.map((it, i) => (
          <li key={i} className="grid grid-cols-[1fr_8rem_auto] items-end gap-2">
            <TextField label={`Item ${i + 1}`} value={it.description} onChange={(e) => setItem(i, 'description', e.target.value)} />
            <TextField label="Amount" type="number" min="0" step="0.01" value={it.amount} onChange={(e) => setItem(i, 'amount', e.target.value)} />
            <Button variant="ghost" size="sm" aria-label={`Remove item ${i + 1}`} icon="trash" disabled={f.items.length === 1} onClick={() => setF({ ...f, items: f.items.filter((_, j) => j !== i) })} /></li>))}</ul>
        {errors.items ? <p className="mt-1 text-sm font-medium text-red-700" role="alert">{errors.items}</p> : null}
        <Button variant="secondary" size="sm" icon="plus" className="mt-2" disabled={f.items.length >= 30} onClick={() => setF({ ...f, items: [...f.items, { description: '', amount: '' }] })}>Add item</Button></fieldset>
      <p className="rounded-lg bg-navy-50 p-3 text-sm">Total preview: <strong>{total != null ? formatMoney(total) : 'no total yet'}</strong> <span className="text-navy-600">(the server calculates the official total)</span></p>
      <TextAreaField label="Scope of work" required rows={4} maxLength={2000} value={f.scopeOfWork} error={errors.scopeOfWork} onChange={set('scopeOfWork')} />
      <TextAreaField label="Payment schedule" rows={3} maxLength={1000} value={f.paymentSchedule} error={errors.paymentSchedule} onChange={set('paymentSchedule')} hint="For example: 50% at the start, 50% on completion; instalments if you offer them." />
      <TextAreaField label="Exclusions" rows={3} maxLength={1500} value={f.exclusions} error={errors.exclusions} onChange={set('exclusions')} hint="What the fee does not cover, for example appeals or court appearances." />
      <TextAreaField label="Expenses note" rows={2} maxLength={1000} value={f.expensesNote} error={errors.expensesNote} onChange={set('expensesNote')} hint="Court fees, travel, translation or other costs that are separate." />
      <TextField label="Proposal valid until" type="date" min={todayIso()} value={f.validUntil} error={errors.validUntil} onChange={set('validUntil')} />
      <TextAreaField label="Note to the client (optional)" rows={2} maxLength={1000} value={f.lawyerNote} onChange={set('lawyerNote')} />
      <Button type="submit" variant="gold" loading={busy}>{q.status === 'proposed' ? 'Send updated proposal' : 'Send proposal'}</Button>
    </form>
  );
}

export default function LawyerQuotationDetail() {
  const { id } = useParams();
  const toast = useToast();
  const { data, loading, error, reload } = useApi(`/quotations/${id}`);
  const [modal, setModal] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const q = data?.quotation;
  useDocumentTitle('Fee quotation');
  const awaiting = q && ['requested', 'revision_requested'].includes(q.status);

  const run = async () => {
    if (busy) return;
    setBusy(true); setErr('');
    try { if (modal === 'decline') await api.post(`/quotations/${id}/decline`, { note: note.trim() || undefined }); else await api.post(`/quotations/${id}/withdraw`); toast.success(modal === 'decline' ? 'You declined to quote.' : 'Proposal withdrawn.'); setModal(''); setNote(''); reload(); }
    catch (e) { setErr(errorMessage(e)); } finally { setBusy(false); }
  };

  return (
    <Loadable loading={loading} error={error} onRetry={reload}>
      {q ? (
        <>
          <PageHeader eyebrow="Fee quotation" title={`Quotation for ${q.client.name}`} actions={<><StatusBadge info={quotationStatusForLawyer(q.status)} /><Button to={`/messages/${q.conversationId}`} variant="secondary" size="sm" icon="message">Conversation</Button></>} />
          <div className="space-y-6">
            <Card><h2 className="text-lg font-semibold">The client’s request</h2>
              <DescriptionList className="mt-2" items={[{ label: 'Work to be quoted', value: <span className="whitespace-pre-line">{q.request.scopeNotes}</span> }, { label: 'Client’s budget', value: q.request.budget != null ? formatMoney(q.request.budget) : 'Not given' }, { label: 'Itemised', value: q.request.itemizedRequested ? 'The client asked for an itemised quotation' : null }, { label: 'Requested', value: formatDate(q.createdAt) }]} /></Card>
            {q.clientResponseNote ? <Alert tone="info" title="Client’s response">{q.clientResponseNote}</Alert> : null}
            {q.proposal && !awaiting ? <Card><h2 className="text-lg font-semibold">Your proposal</h2><div className="mt-2"><ProposalView proposal={q.proposal} /></div></Card> : null}
            {awaiting ? (
              <Card><h2 className="mb-1 text-lg font-semibold">{q.status === 'revision_requested' ? 'Update your proposal' : 'Send a proposal'}</h2>
                <p className="mb-4 text-sm text-navy-700">The client can accept, decline or ask for changes. Set the fee you consider appropriate: nobody is pressured to accept a price.</p>
                <ProposalForm q={q} onDone={reload} />
                <div className="mt-4 border-t border-navy-100 pt-4"><Button variant="ghost" onClick={() => setModal('decline')}>Decline to quote</Button></div></Card>
            ) : null}
            {q.status === 'proposed' ? <Button variant="secondary" onClick={() => setModal('withdraw')}>Withdraw proposal</Button> : null}
            {['accepted', 'declined', 'withdrawn'].includes(q.status) ? <Alert tone="info">{q.status === 'accepted' ? 'The client accepted in principle. This is not a contract: agree the engagement directly with the client.' : 'This quotation is closed.'}</Alert> : null}
          </div>
          <Modal open={Boolean(modal)} onClose={() => { setModal(''); setErr(''); }} title={modal === 'decline' ? 'Decline to quote?' : 'Withdraw this proposal?'} description={modal === 'decline' ? 'No reason is required, but a short note is welcome.' : 'The client will see the proposal was withdrawn.'}
            footer={<><Button variant="ghost" onClick={() => setModal('')}>Cancel</Button><Button variant="danger" loading={busy} onClick={run}>{modal === 'decline' ? 'Decline' : 'Withdraw'}</Button></>}>
            {err ? <Alert tone="danger" className="mb-3">{err}</Alert> : null}
            {modal === 'decline' ? <TextAreaField label="Note to the client (optional)" rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} /> : null}
          </Modal>
        </>
      ) : null}
    </Loadable>
  );
}
