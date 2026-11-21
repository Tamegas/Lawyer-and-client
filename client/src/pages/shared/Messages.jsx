import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AppointmentDialog } from '../../components/profile/AppointmentDialog.jsx';
import { QuotationRequestDialog } from '../../components/quotes/QuotationRequestDialog.jsx';
import { ReportDialog } from '../../components/reports/ReportDialog.jsx';
import { Badge, StatusBadge } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Alert, EmptyState, Loadable } from '../../components/ui/Feedback.jsx';
import { CheckboxField, SelectField, TextAreaField } from '../../components/ui/Fields.jsx';
import { Icon } from '../../components/ui/Icon.jsx';
import { PageHeader } from '../../components/ui/Primitives.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useDocumentTitle } from '../../hooks/usePage.js';
import { api, errorMessage } from '../../lib/api.js';
import { formatDate, formatDateTime, formatMoney, relativeTime, viewerTimeZone } from '../../lib/format.js';
import { CONSULT_PREFERENCE_LABELS, HELP_TYPE_LABELS, appointmentStatusInfo, quotationStatusForLawyer, quotationStatusInfo, verificationInfo } from '../../lib/labels.js';

function ConversationList({ items, activeId }) {
  return (
    <ul className="divide-y divide-navy-100" aria-label="Conversations">
      {items.map((c) => (
        <li key={c.id}>
          <Link to={`/messages/${c.id}`} aria-current={c.id === activeId ? 'page' : undefined} className={`block px-4 py-3 hover:bg-navy-50 ${c.id === activeId ? 'bg-navy-100/70' : ''}`}>
            <div className="flex items-center justify-between gap-2">
              <span className={`truncate text-sm ${c.unread ? 'font-bold text-navy-950' : 'font-medium text-navy-900'}`}>{c.counterpart?.name}</span>
              <span className="shrink-0 text-xs text-navy-600">{relativeTime(c.lastMessageAt)}</span>
            </div>
            <p className="mt-0.5 truncate text-xs text-navy-600">{c.lastMessage ? `${c.lastMessage.fromMe ? 'You: ' : ''}${c.lastMessage.body}` : 'No messages'}</p>
            <div className="mt-1 flex flex-wrap gap-1.5">{c.unread ? <Badge tone="gold">New</Badge> : null}{c.status === 'closed' ? <Badge>Closed</Badge> : null}</div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function SharePanel({ conv, onChanged }) {
  const toast = useToast();
  const reqs = useApi('/requests', { enabled: !conv.requestShared });
  const [requestId, setRequestId] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const run = async (fn, ok) => { if (busy) return; setBusy(true); try { await fn(); toast.success(ok); onChanged(); } catch (err) { toast.error(errorMessage(err)); } finally { setBusy(false); } };
  if (conv.requestShared) {
    return <Alert tone="info" title="You shared a legal request with this lawyer" action={<Button size="sm" variant="secondary" loading={busy} onClick={() => run(() => api.delete(`/conversations/${conv.id}/share-request`), 'Access withdrawn.')}>Withdraw access</Button>}>They can read it until you withdraw access.</Alert>;
  }
  const list = reqs.data?.requests ?? [];
  if (!list.length) return null;
  return (
    <details className="rounded-xl bg-white p-4 ring-1 ring-navy-100">
      <summary className="cursor-pointer text-sm font-medium">Share one of your legal requests with this lawyer (optional)</summary>
      <div className="mt-3 space-y-3">
        <SelectField label="Request" placeholder="Choose a request" value={requestId} onChange={(e) => { setRequestId(e.target.value); setConsent(false); }} options={list.map((r) => ({ value: r.id, label: `${r.category.name} · ${formatDate(r.createdAt)}` }))} />
        <CheckboxField checked={consent} onChange={(e) => setConsent(e.target.checked)} label="I agree to share this request with this lawyer." hint="They will see the category, your description, location, dates, deadline, language, method and budget. You can withdraw access later." />
        <Button size="sm" disabled={!requestId || !consent} loading={busy} onClick={() => run(() => api.post(`/conversations/${conv.id}/share-request`, { requestId, consent: true }), 'Request shared.')}>Share request</Button>
      </div>
    </details>
  );
}

function Thread({ id, role, onChanged }) {
  const toast = useToast();
  const { data, loading, error, reload } = useApi(`/conversations/${id}`);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [report, setReport] = useState(null);
  const [dialog, setDialog] = useState('');
  const endRef = useRef(null);
  const c = data?.conversation;

  useEffect(() => { setBody(''); }, [id]);
  useEffect(() => { if (data) { api.post(`/conversations/${id}/read`).then(onChanged).catch(() => {}); endRef.current?.scrollIntoView({ block: 'end' }); } }, [id, data?.messages?.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = async (e) => {
    e.preventDefault();
    if (sending || !body.trim()) return;
    setSending(true);
    try { await api.post(`/conversations/${id}/messages`, { body: body.trim() }); setBody(''); reload(); onChanged(); }
    catch (err) { toast.error(errorMessage(err)); } finally { setSending(false); }
  };
  const setStatus = async (status) => { try { await api.patch(`/conversations/${id}`, { status }); reload(); onChanged(); } catch (err) { toast.error(errorMessage(err)); } };

  return (
    <Loadable loading={loading} error={error} onRetry={reload}>
      {c ? (
        <div className="flex h-full flex-col">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-navy-100 p-4">
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold">{c.counterpart?.slug ? <Link to={`/lawyers/${c.counterpart.slug}`} className="hover:underline">{c.counterpart.name}</Link> : c.counterpart?.name}</h2>
              {c.counterpart?.verificationStatus ? <StatusBadge info={verificationInfo(c.counterpart.verificationStatus)} /> : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" icon="refresh" onClick={reload}>Refresh</Button>
              <Button size="sm" variant="ghost" onClick={() => setStatus(c.status === 'open' ? 'closed' : 'open')}>{c.status === 'open' ? 'Close' : 'Reopen'}</Button>
            </div>
          </div>
          <p className="border-b border-navy-100 bg-navy-50 px-4 py-2 text-xs text-navy-600">Messages are delivered inside the app and are not live chat. There are no email or SMS notifications yet. Times are in {viewerTimeZone()}.</p>

          <div className="flex-1 space-y-4 overflow-y-auto p-4" style={{ maxHeight: '55vh' }}>
            {role === 'client' ? <SharePanel conv={c} onChanged={reload} /> : null}
            {role === 'lawyer' ? (data.request ? (
              <div className="rounded-xl bg-gold-50 p-4 text-sm ring-1 ring-gold-200"><p className="font-semibold">Shared legal request ({data.request.category?.name})</p>
                <p className="mt-1 whitespace-pre-line text-navy-900">{data.request.summary}</p>
                <p className="mt-2 text-xs text-navy-700">{[data.request.location?.name, data.request.hasUrgentDeadline ? `Deadline ${data.request.deadlineOn ? formatDate(data.request.deadlineOn) : '(date not given)'}` : null, HELP_TYPE_LABELS[data.request.helpType], data.request.preferredLanguage, CONSULT_PREFERENCE_LABELS[data.request.consultationPreference], data.request.budgetMax != null ? `Budget up to ${formatMoney(data.request.budgetMax, data.request.currency)}` : null].filter(Boolean).join(' · ')}</p></div>
            ) : <p className="rounded-xl bg-navy-50 p-3 text-xs text-navy-700">The client has not shared a legal request with you. You can only see their messages.</p>) : null}

            <ul className="space-y-3" aria-label="Messages">
              {data.messages.map((m) => (
                <li key={m.id} className={`flex ${m.fromMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${m.fromMe ? 'bg-navy-900 text-white' : 'bg-navy-100 text-navy-950'}`}>
                    <p className="whitespace-pre-line break-words">{m.body}</p>
                    <p className={`mt-1 flex items-center gap-2 text-[11px] ${m.fromMe ? 'text-navy-200' : 'text-navy-600'}`}>{m.fromMe ? 'You' : m.senderName} · {formatDateTime(m.createdAt)}
                      {!m.fromMe ? <button type="button" className="underline" onClick={() => setReport(m)}>Report</button> : null}</p>
                  </div>
                </li>
              ))}
            </ul>
            <div ref={endRef} />

            {data.quotations?.length || data.appointments?.length ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {data.quotations?.length ? <div className="rounded-xl bg-white p-3 ring-1 ring-navy-100"><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy-600">Fee quotations</p>
                  <ul className="space-y-1.5 text-sm">{data.quotations.map((q) => <li key={q.id} className="flex items-center justify-between gap-2"><Link className="underline" to={`/${role}/quotations/${q.id}`}>{q.totalEstimate != null ? formatMoney(q.totalEstimate, q.currency) : 'Quotation'}</Link><StatusBadge info={(role === 'lawyer' ? quotationStatusForLawyer : quotationStatusInfo)(q.status)} /></li>)}</ul></div> : null}
                {data.appointments?.length ? <div className="rounded-xl bg-white p-3 ring-1 ring-navy-100"><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy-600">Appointments</p>
                  <ul className="space-y-1.5 text-sm">{data.appointments.map((a) => <li key={a.id} className="flex items-center justify-between gap-2"><Link className="underline" to={`/${role}/appointments`}>{formatDateTime(a.startsAt)}</Link><StatusBadge info={appointmentStatusInfo(a.status)} /></li>)}</ul></div> : null}
              </div>
            ) : null}
          </div>

          {role === 'client' && c.status === 'open' ? (
            <div className="flex flex-wrap gap-2 border-t border-navy-100 px-4 pt-3">
              <Button size="sm" variant="secondary" icon="coins" onClick={() => setDialog('quote')}>Request a fee quotation</Button>
              {c.counterpart?.slug ? <Button size="sm" variant="secondary" icon="calendar" onClick={() => setDialog('appt')}>Request an appointment</Button> : null}
            </div>
          ) : null}

          {c.status === 'closed' ? <Alert className="m-4" tone="info">This conversation is closed. Reopen it to send messages.</Alert> : (
            <form onSubmit={send} className="border-t border-navy-100 p-4">
              <TextAreaField label="Write a message" rows={3} maxLength={4000} value={body} onChange={(e) => setBody(e.target.value)} hint="Please don’t share passwords, ID numbers or bank details." />
              <div className="mt-3 flex justify-end"><Button type="submit" icon="send" loading={sending} disabled={!body.trim()}>Send</Button></div>
            </form>
          )}
          <ReportDialog open={Boolean(report)} onClose={() => setReport(null)} targetType="message" targetId={report?.id} targetLabel="this message" />
          {dialog === 'quote' ? <QuotationRequestDialog open onClose={() => setDialog('')} conversationId={id} lawyerName={c.counterpart?.name} /> : null}
          {dialog === 'appt' ? <AppointmentDialog open onClose={() => setDialog('')} lawyer={{ slug: c.counterpart.slug, name: c.counterpart.name, consultationModes: [] }} /> : null}
        </div>
      ) : null}
    </Loadable>
  );
}

export default function Messages() {
  useDocumentTitle('Messages');
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const list = useApi('/conversations');
  const items = list.data?.conversations ?? [];
  return (
    <>
      <PageHeader title={user?.role === 'lawyer' ? 'Inquiries' : 'Messages'} description="Conversations with the other person on the platform. Clients start conversations from a lawyer’s profile." actions={<Button variant="secondary" size="sm" icon="refresh" onClick={list.reload}>Refresh</Button>} />
      <div className="grid overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-navy-100 lg:grid-cols-[20rem_1fr]">
        <div className={`${id ? 'hidden lg:block' : ''} max-h-[70vh] overflow-y-auto border-navy-100 lg:border-r`}>
          <Loadable loading={list.loading} error={list.error} onRetry={list.reload} isEmpty={!items.length}
            empty={<div className="p-4"><EmptyState icon="inbox" title="No conversations yet" description={user?.role === 'lawyer' ? 'Clients contact you from your public profile. Inquiries will appear here.' : 'Open a lawyer’s profile and choose “Contact Lawyer” to start.'} action={user?.role === 'client' ? <Button to="/lawyers">Find a lawyer</Button> : undefined} /></div>}>
            <ConversationList items={items} activeId={id} />
          </Loadable>
        </div>
        <div className={`${id ? '' : 'hidden lg:flex'} min-h-[24rem] min-w-0 flex-col`}>
          {id ? (
            <>
              <div className="border-b border-navy-100 p-2 lg:hidden"><Button size="sm" variant="ghost" icon="arrow-left" onClick={() => navigate('/messages')}>All conversations</Button></div>
              <Thread key={id} id={id} role={user?.role} onChanged={list.reload} />
            </>
          ) : <div className="flex flex-1 items-center justify-center p-10 text-center text-sm text-navy-600"><div><Icon name="message" className="mx-auto mb-2 h-8 w-8 text-navy-300" />Select a conversation to read it.</div></div>}
        </div>
      </div>
    </>
  );
}
