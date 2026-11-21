import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert } from '../ui/Feedback.jsx';
import { Button } from '../ui/Button.jsx';
import { CheckboxField, SelectField, TextAreaField } from '../ui/Fields.jsx';
import { Modal } from '../ui/Modal.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useApi } from '../../hooks/useApi.js';
import { api, errorMessage } from '../../lib/api.js';
import { formatDate } from '../../lib/format.js';

/** Sends the first message to a lawyer; optionally shares one of the client's own legal requests, only with explicit consent. */
export function ContactDialog({ open, onClose, lawyer }) {
  const navigate = useNavigate();
  const toast = useToast();
  const requests = useApi('/requests', { enabled: open });
  const [message, setMessage] = useState('');
  const [requestId, setRequestId] = useState('');
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState({});
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) { setMessage(''); setRequestId(''); setConsent(false); setErrors({}); setNote(''); } }, [open]);
  const list = requests.data?.requests ?? [];
  const chosen = list.find((r) => r.id === requestId);

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    const next = {};
    if (!message.trim()) next.message = 'Write a short message to the lawyer';
    if (requestId && !consent) next.consent = 'Tick the box to share this request, or choose “Don’t share a request”';
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true); setNote('');
    try {
      const body = { lawyerSlug: lawyer.slug, message: message.trim() };
      if (requestId) body.shareRequest = { requestId, consent: true };
      const res = await api.post('/conversations', body);
      toast.success('Message sent.');
      onClose();
      navigate(`/messages/${res.conversation.id}`);
    } catch (err) {
      if (err?.fields) setErrors(err.fields); else setNote(errorMessage(err));
    } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Contact ${lawyer.name}`} description="Messages are delivered inside the app. There are no email or SMS notifications yet, so check Messages for a reply."
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" form="contact-form" loading={busy}>Send message</Button></>}>
      <form id="contact-form" onSubmit={submit} className="space-y-4" noValidate>
        {note ? <Alert tone="danger">{note}</Alert> : null}
        <TextAreaField label="Your message" required maxLength={4000} rows={5} value={message} error={errors.message} onChange={(e) => setMessage(e.target.value)}
          hint="Introduce yourself and the kind of help you need. Please don’t include ID numbers, passwords or confidential documents." />
        <SelectField label="Share one of your legal requests (optional)" value={requestId} onChange={(e) => { setRequestId(e.target.value); setConsent(false); }}
          options={[{ value: '', label: 'Don’t share a request' }, ...list.map((r) => ({ value: r.id, label: `${r.category.name} · ${formatDate(r.createdAt)}` }))]}
          hint={requests.loading ? 'Loading your requests…' : list.length ? 'By default the lawyer sees only your message.' : 'You have no saved requests. You can describe your problem first, or just send a message.'} />
        {chosen ? (
          <div className="rounded-xl bg-navy-50 p-4 text-sm">
            <p className="font-medium text-navy-950">What this lawyer would be able to read</p>
            <p className="mt-1 text-navy-800">Category, your description, location, dates, deadline, preferred language and consultation method, and your budget range if you entered one.</p>
            <blockquote className="mt-2 border-l-2 border-gold-400 pl-3 text-navy-700">{chosen.summary.length > 220 ? `${chosen.summary.slice(0, 220)}…` : chosen.summary}</blockquote>
            <div className="mt-3"><CheckboxField checked={consent} error={errors.consent} onChange={(e) => setConsent(e.target.checked)}
              label={`I agree to share this request with ${lawyer.name}.`} hint="You can withdraw their access later from the conversation." /></div>
          </div>
        ) : null}
      </form>
    </Modal>
  );
}
