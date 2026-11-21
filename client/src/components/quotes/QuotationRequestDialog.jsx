import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert } from '../ui/Feedback.jsx';
import { Button } from '../ui/Button.jsx';
import { CheckboxField, TextAreaField, TextField } from '../ui/Fields.jsx';
import { Modal } from '../ui/Modal.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { api, errorMessage } from '../../lib/api.js';

/** Client asks for a fee quotation inside an existing conversation (POST /api/quotations). */
export function QuotationRequestDialog({ open, onClose, conversationId, lawyerName }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [v, setV] = useState({ scopeNotes: '', budget: '', itemized: true });
  const [errors, setErrors] = useState({});
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setV({ scopeNotes: '', budget: '', itemized: true }); setErrors({}); setNote(''); } }, [open]);

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    if (v.scopeNotes.trim().length < 5) { setErrors({ scopeNotes: 'Describe the work you want quoted' }); return; }
    setBusy(true); setNote('');
    try {
      const r = await api.post('/quotations', { conversationId, scopeNotes: v.scopeNotes.trim(), budget: v.budget === '' ? null : Number(v.budget), itemized: v.itemized });
      toast.success('Quotation requested.');
      onClose();
      navigate(`/client/quotations/${r.quotation.id}`);
    } catch (err) { if (err?.fields) setErrors(err.fields); else setNote(errorMessage(err)); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Request a fee quotation" description={`${lawyerName ?? 'The lawyer'} can reply with a proposed fee, scope of work, payment schedule and exclusions. It is non-binding.`}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" form="quote-req-form" loading={busy}>Request quotation</Button></>}>
      <form id="quote-req-form" onSubmit={submit} className="space-y-4" noValidate>
        {note ? <Alert tone="danger">{note}</Alert> : null}
        <TextAreaField label="Work to be quoted" required rows={4} maxLength={1500} value={v.scopeNotes} error={errors.scopeNotes} onChange={(e) => setV({ ...v, scopeNotes: e.target.value })} />
        <TextField label="Your estimated budget (ETB, optional)" type="number" min="0" inputMode="decimal" value={v.budget} error={errors.budget} onChange={(e) => setV({ ...v, budget: e.target.value })} hint="A starting point for discussion. The lawyer is free to propose any fee." />
        <CheckboxField label="Ask for an itemised quotation" checked={v.itemized} onChange={(e) => setV({ ...v, itemized: e.target.checked })} />
      </form>
    </Modal>
  );
}
