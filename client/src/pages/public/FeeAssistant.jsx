import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { StatusBadge } from '../../components/ui/Badge.jsx';
import { Alert, Loadable } from '../../components/ui/Feedback.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { CheckboxField, SelectField, TextAreaField, TextField } from '../../components/ui/Fields.jsx';
import { Card, Container, PageHeader } from '../../components/ui/Primitives.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useDocumentTitle } from '../../hooks/usePage.js';
import { api, errorMessage } from '../../lib/api.js';
import { formatDate, formatMoney } from '../../lib/format.js';
import { FEE_TYPE_LABELS, quotationStatusInfo } from '../../lib/labels.js';

const EXPLAINERS = [
  ['Consultation fee', 'A charge for an initial conversation about your issue. It may be free, a fixed amount, or credited against later work: ask.'],
  ['Hourly rate', 'The lawyer charges for time spent. Ask for an estimate of the hours and how time is recorded.'],
  ['Fixed fee', 'One agreed price for a clearly defined piece of work. Make sure the scope and exclusions are written down.'],
  ['Additional expenses', 'Costs that may be separate from the lawyer’s fee, such as court fees, travel, translation or document costs. Ask which apply and who pays them.'],
];

const QUESTIONS = [
  'What services are included in this fee?',
  'Are court appearances and document preparation charged separately?',
  'Would you consider a fixed fee for this specific scope of work?',
  'Are installment payments available?',
  'Which additional expenses (for example court fees, travel or translation) should I expect?',
  'Can you give me an itemised quotation and an estimate of the total?',
  'How long is this quotation valid, and what happens if the scope changes?',
  'How will we communicate, and how often will I receive updates?',
];

function Questions({ budget }) {
  const toast = useToast();
  const [picked, setPicked] = useState(QUESTIONS.slice(0, 4));
  const text = useMemo(() => `Hello,\n\nThank you for your time. Before we decide how to proceed, I would be grateful if you could help me understand your fees${budget ? ` (my budget for this work is about ${formatMoney(Number(budget))})` : ''}:\n\n${picked.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n\nThank you very much.`, [picked, budget]);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); toast.success('Message copied.'); }
    catch { toast.info('Select the text and copy it manually.'); }
  };
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <fieldset><legend className="mb-2 text-sm font-medium">Pick the questions you want to ask</legend>
        <div className="space-y-2">{QUESTIONS.map((q) => <CheckboxField key={q} label={q} checked={picked.includes(q)} onChange={(e) => setPicked((p) => (e.target.checked ? [...p, q] : p.filter((x) => x !== q)))} />)}</div></fieldset>
      <div><label htmlFor="fee-msg" className="mb-2 block text-sm font-medium">Your message</label>
        <textarea id="fee-msg" readOnly value={text} rows={12} className="w-full rounded-lg border border-navy-200 bg-navy-50 p-3 text-sm" />
        <div className="mt-3 flex flex-wrap gap-2"><Button onClick={copy} icon="copy" disabled={!picked.length}>Copy message</Button><Button to="/messages" variant="secondary">Go to Messages</Button></div></div>
    </div>
  );
}

function Compare({ budget }) {
  const { data, loading, error, reload } = useApi('/quotations');
  const rows = (data?.quotations ?? []).filter((q) => q.proposal);
  return (
    <Loadable loading={loading} error={error} onRetry={reload} isEmpty={!rows.length}
      empty={<p className="text-sm text-navy-700">No proposals to compare yet. Ask lawyers for itemised quotations below, and their proposals will appear here.</p>}>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <caption className="sr-only">Fee proposals received from different lawyers</caption>
          <thead><tr className="border-b border-navy-200 text-navy-600"><th scope="col" className="py-2 pr-4">Lawyer</th><th scope="col" className="pr-4">Fee type</th><th scope="col" className="pr-4">Total estimate</th><th scope="col" className="pr-4">Scope</th><th scope="col" className="pr-4">Payment schedule</th><th scope="col" className="pr-4">Exclusions</th><th scope="col" className="pr-4">Valid until</th><th scope="col">Status</th></tr></thead>
          <tbody>{rows.map((q) => (
            <tr key={q.id} className="border-b border-navy-100 align-top">
              <th scope="row" className="py-3 pr-4 font-medium"><Link to={`/client/quotations/${q.id}`} className="underline">{q.lawyer.name}</Link></th>
              <td className="pr-4">{FEE_TYPE_LABELS[q.proposal.feeType]}</td>
              <td className="pr-4 font-semibold">{formatMoney(q.proposal.totalEstimate, q.proposal.currency)}{budget ? <span className="block text-xs font-normal text-navy-600">{Number(q.proposal.totalEstimate) <= Number(budget) ? 'Within' : 'Above'} your budget</span> : null}</td>
              <td className="max-w-[14rem] pr-4">{q.proposal.scopeOfWork}</td><td className="max-w-[10rem] pr-4">{q.proposal.paymentSchedule ?? '—'}</td><td className="max-w-[10rem] pr-4">{q.proposal.exclusions ?? '—'}</td>
              <td className="pr-4">{q.proposal.validUntil ? formatDate(q.proposal.validUntil) : '—'}</td><td><StatusBadge info={quotationStatusInfo(q.status)} /></td>
            </tr>))}</tbody>
        </table>
      </div>
      <ul className="space-y-3 md:hidden">{rows.map((q) => (
        <li key={q.id} className="rounded-xl bg-white p-4 ring-1 ring-navy-100">
          <div className="flex items-start justify-between gap-2"><Link to={`/client/quotations/${q.id}`} className="font-medium underline">{q.lawyer.name}</Link><StatusBadge info={quotationStatusInfo(q.status)} /></div>
          <p className="mt-1 font-serif text-xl font-semibold">{formatMoney(q.proposal.totalEstimate, q.proposal.currency)}</p>
          <p className="text-sm text-navy-700">{FEE_TYPE_LABELS[q.proposal.feeType]} · {q.proposal.scopeOfWork}</p>
          <p className="mt-1 text-xs text-navy-600">Payment: {q.proposal.paymentSchedule ?? '—'} · Exclusions: {q.proposal.exclusions ?? '—'}</p>
        </li>))}</ul>
    </Loadable>
  );
}

function Request({ budget }) {
  const navigate = useNavigate();
  const toast = useToast();
  const convs = useApi('/conversations');
  const open = (convs.data?.conversations ?? []).filter((c) => c.status === 'open');
  const [v, setV] = useState({ conversationId: '', scopeNotes: '', itemized: true });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    const errs = {};
    if (!v.conversationId) errs.conversationId = 'Choose a conversation';
    if (v.scopeNotes.trim().length < 5) errs.scopeNotes = 'Describe the work you want quoted';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true); setNote('');
    try {
      const r = await api.post('/quotations', { conversationId: v.conversationId, scopeNotes: v.scopeNotes.trim(), budget: budget === '' ? null : Number(budget), itemized: v.itemized });
      toast.success('Quotation requested.');
      navigate(`/client/quotations/${r.quotation.id}`);
    } catch (err) { if (err?.fields) setErrors(err.fields); else setNote(errorMessage(err)); } finally { setBusy(false); }
  };
  if (convs.loading) return null;
  if (!open.length) return <Alert tone="info">To request a quotation you first need a conversation with a lawyer. <Link to="/lawyers" className="font-medium underline">Find a lawyer</Link> and send a message, or use “Request a Fee Estimate” on their profile.</Alert>;
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {note ? <Alert tone="danger">{note}</Alert> : null}
      <SelectField label="Which lawyer?" placeholder="Choose a conversation" value={v.conversationId} error={errors.conversationId} onChange={(e) => setV({ ...v, conversationId: e.target.value })} options={open.map((c) => ({ value: c.id, label: c.counterpart.name }))} />
      <TextAreaField label="Work to be quoted" required rows={4} maxLength={1500} value={v.scopeNotes} error={errors.scopeNotes} onChange={(e) => setV({ ...v, scopeNotes: e.target.value })} />
      <CheckboxField label="Ask for an itemised quotation" checked={v.itemized} onChange={(e) => setV({ ...v, itemized: e.target.checked })} />
      <Button type="submit" loading={busy}>Request quotation</Button>
    </form>
  );
}

export default function FeeAssistant() {
  useDocumentTitle('Fee Discussion Assistant');
  const { user, promptAuth } = useAuth();
  const [budget, setBudget] = useState('');
  const isClient = user?.role === 'client';
  return (
    <Container className="py-10">
      <PageHeader eyebrow="Fee Discussion Assistant" title="Understand and discuss legal fees with confidence" description="Learn what the different fees mean, prepare polite questions, request itemised quotations and compare proposals. The aim is a transparent conversation, never pressure on a lawyer to accept a price." />
      <div className="space-y-8">
        <Card><h2 className="text-xl font-semibold">1. What the different fees mean</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">{EXPLAINERS.map(([t, d]) => <div key={t}><dt className="font-medium text-navy-950">{t}</dt><dd className="mt-1 text-sm leading-6 text-navy-700">{d}</dd></div>)}</dl>
          <p className="mt-4 text-xs text-navy-600">These are general explanations. Actual practice varies between lawyers, and this page does not state typical prices or what any law requires.</p></Card>
        <Card><h2 className="text-xl font-semibold">2. Your estimated budget</h2>
          <div className="mt-3 max-w-xs"><TextField label="Budget for this legal work (ETB)" type="number" min="0" inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} hint="Optional. Used only on this page, in your browser, to compare proposals. Not saved or shared." /></div></Card>
        <Card><h2 className="text-xl font-semibold">3. Polite questions to ask about fees</h2><div className="mt-4"><Questions budget={budget} /></div></Card>
        <Card><h2 className="text-xl font-semibold">4. Compare quotations</h2><div className="mt-4">
          {isClient ? <Compare budget={budget} /> : user ? <p className="text-sm text-navy-700">Lawyers respond to quotation requests from their <Link to="/lawyer/quotations" className="underline">Fee quotations</Link> page.</p>
            : <Alert tone="info" action={<Button size="sm" onClick={() => promptAuth({ mode: 'login', role: 'client', message: 'Sign in to see and compare your quotations.' })}>Sign in</Button>}>Sign in to compare the proposals you have received.</Alert>}</div></Card>
        <Card><h2 className="text-xl font-semibold">5. Request an itemised quotation</h2><div className="mt-4">
          {isClient ? <Request budget={budget} /> : user ? <p className="text-sm text-navy-700">Only client accounts can request quotations.</p>
            : <Alert tone="info" action={<Button size="sm" onClick={() => promptAuth({ mode: 'register', role: 'client', message: 'Create a free account to request quotations.' })}>Get started</Button>}>Create a free account to request quotations from lawyers.</Alert>}</div></Card>
        <Card><h2 className="text-xl font-semibold">For lawyers</h2><p className="mt-2 text-sm leading-6 text-navy-700">Lawyers answer a request with a proposed fee, a scope of work, a payment schedule and any exclusions. Clients can accept, decline or ask for changes. A quotation is a non-binding proposal, and fees are negotiable only if the lawyer says so.</p></Card>
      </div>
    </Container>
  );
}
