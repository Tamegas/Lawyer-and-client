import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert } from '../ui/Feedback.jsx';
import { Button } from '../ui/Button.jsx';
import { CheckboxField, TextAreaField, TextField } from '../ui/Fields.jsx';
import { Modal } from '../ui/Modal.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useApi } from '../../hooks/useApi.js';
import { api, errorMessage } from '../../lib/api.js';

/** "Request a Fee Estimate": uses the existing conversation with this lawyer or starts one, then POST /quotations. */
export function EstimateDialog({ open, onClose, lawyer }) {
  const navigate = useNavigate();
  const toast = useToast();
  const convs = useApi('/conversations', { enabled: open });
  const [v, setV] = useState({ scopeNotes: '', budget: '', itemized: true });
  const [errors, setErrors] = useState({});
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setV({ scopeNotes: '', budget: '', itemized: true }); setErrors({}); setNote(''); } }, [open]);
  const existing = convs.data?.conversations?.find((c) => c.counterpart?.slug === lawyer.slug && c.status === 'open');

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    if (v.scopeNotes.trim().length < 5) { setErrors({ scopeNotes: 'Describe the work you want a quotation for' }); return; }
    setBusy(true); setNote('');
    try {
      let conversationId = existing?.id;
      if (!conversationId) {
        const c = await api.post('/conversations', { lawyerSlug: lawyer.slug, message: `Fee estimate request: ${v.scopeNotes.trim()}`.slice(0, 4000) });
        conversationId = c.conversation.id;
      }
      const res = await api.post('/quotations', { conversationId, scopeNotes: v.scopeNotes.trim(), budget: v.budget === '' ? null : Number(v.budget), itemized: v.itemized });
      toast.success('Quotation requested. The lawyer will reply with a proposal.');
      onClose();
      navigate(`/client/quotations/${res.quotation.id}`);
    } catch (err) {
      if (err?.fields) setErrors(err.fields); else setNote(errorMessage(err));
    } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Request a fee estimate" description={`Ask ${lawyer.name} for a proposal covering the work you describe. A quotation is non-binding.`}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" form="estimate-form" loading={busy}>Request quotation</Button></>}>
      <form id="estimate-form" onSubmit={submit} className="space-y-4" noValidate>
        {note ? <Alert tone="danger">{note}</Alert> : null}
        <TextAreaField label="What work do you need quoted?" required maxLength={1500} rows={5} value={v.scopeNotes} error={errors.scopeNotes} onChange={(e) => setV({ ...v, scopeNotes: e.target.value })}
          hint="General terms only, for example “draft and review a lease agreement” or “representation in a family dispute”." />
        <TextField label="Your estimated budget (ETB, optional)" type="number" min="0" inputMode="decimal" value={v.budget} error={errors.budget} onChange={(e) => setV({ ...v, budget: e.target.value })}
          hint="Optional. The lawyer is free to propose any fee: a budget is a starting point for discussion, not a demand." />
        <CheckboxField checked={v.itemized} onChange={(e) => setV({ ...v, itemized: e.target.checked })} label="Ask for an itemised quotation" hint="Each part of the work and its cost listed separately." />
        <p className="text-xs text-navy-600">{existing ? 'This will be added to your existing conversation with this lawyer.' : 'Because you have no conversation with this lawyer yet, your description is also sent to them as a first message. Your saved legal requests are not shared.'}</p>
      </form>
    </Modal>
  );
}
