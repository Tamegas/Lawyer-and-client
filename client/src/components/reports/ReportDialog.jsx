import { useEffect, useState } from 'react';
import { useToast } from '../../context/ToastContext.jsx';
import { api, errorMessage } from '../../lib/api.js';
import { REPORT_REASON_LABELS } from '../../lib/labels.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { Alert } from '../ui/Feedback.jsx';
import { SelectField, TextAreaField } from '../ui/Fields.jsx';
import { Button } from '../ui/Button.jsx';
import { Modal } from '../ui/Modal.jsx';

/** <ReportDialog open onClose targetType="lawyer_profile|review|case|message" targetId targetLabel /> → POST /api/reports */
export function ReportDialog({ open, onClose, targetType, targetId, targetLabel }) {
  const toast = useToast();
  const { user, promptAuth } = useAuth();
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => { if (open) { setReason(''); setDetails(''); setErrors({}); setNote(''); } }, [open]);

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    if (!reason) { setErrors({ reason: 'Choose a reason' }); return; }
    let who = user;
    if (!who) who = await promptAuth({ mode: 'login', role: 'client', message: 'Sign in to send a report. Reports are reviewed by an administrator.' });
    if (!who) return;
    setBusy(true);
    try {
      await api.post('/reports', { targetType, targetId, reason, details: details.trim() || undefined });
      toast.success('Thank you. Your report was sent to the administrators.');
      onClose();
    } catch (err) {
      if (err?.fields) setErrors(err.fields); else setNote(errorMessage(err));
    } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Report ${targetLabel ?? 'this item'}`} description="Reports go to platform administrators. Please do not include confidential case details."
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" form="report-form" loading={busy}>Send report</Button></>}>
      <form id="report-form" onSubmit={submit} className="space-y-4" noValidate>
        {note ? <Alert tone="danger">{note}</Alert> : null}
        <SelectField label="Reason" required placeholder="Choose a reason" value={reason} error={errors.reason}
          onChange={(e) => { setReason(e.target.value); setErrors((x) => ({ ...x, reason: undefined })); }}
          options={Object.entries(REPORT_REASON_LABELS).map(([value, label]) => ({ value, label: typeof label === 'string' ? label : label.label }))} />
        <TextAreaField label="Details (optional)" maxLength={1000} rows={4} value={details} error={errors.details}
          hint="What should the administrators know? Don’t include private client information." onChange={(e) => setDetails(e.target.value)} />
      </form>
    </Modal>
  );
}
