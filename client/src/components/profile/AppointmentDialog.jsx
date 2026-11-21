import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Skeleton } from '../ui/Feedback.jsx';
import { Button } from '../ui/Button.jsx';
import { CheckboxField, RadioGroup, TextAreaField } from '../ui/Fields.jsx';
import { Modal } from '../ui/Modal.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useApi } from '../../hooks/useApi.js';
import { api, errorMessage } from '../../lib/api.js';
import { formatDate, formatTime, viewerTimeZone } from '../../lib/format.js';
import { MODE_LABELS } from '../../lib/labels.js';

const dayKey = (iso) => new Intl.DateTimeFormat('en-CA').format(new Date(iso)); // YYYY-MM-DD in the viewer's zone

/** Request an appointment: pick one of the lawyer's real bookable slots (shown in your own time zone). */
export function AppointmentDialog({ open, onClose, lawyer }) {
  const navigate = useNavigate();
  const toast = useToast();
  const slots = useApi('/appointments/slots', { params: { lawyer: lawyer.slug }, enabled: open });
  const [day, setDay] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [mode, setMode] = useState('');
  const [reason, setReason] = useState('');
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState({});
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const modes = lawyer.consultationModes?.length ? lawyer.consultationModes : ['online', 'in_person'];

  useEffect(() => { if (open) { setDay(''); setStartsAt(''); setMode(modes.length === 1 ? modes[0] : ''); setReason(''); setConsent(false); setErrors({}); setNote(''); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const all = slots.data?.slots ?? [];
  const days = useMemo(() => [...new Set(all.map((s) => dayKey(s.startsAt)))], [all]);
  const today = day || days[0] || '';
  const forDay = all.filter((s) => dayKey(s.startsAt) === today);

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    const next = {};
    if (!startsAt) next.startsAt = 'Choose a time';
    if (!mode) next.mode = 'Choose online or in person';
    if (reason.trim().length < 5) next.reason = 'Briefly explain the reason for the consultation';
    if (!consent) next.consent = 'Please confirm to continue';
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true); setNote('');
    try {
      await api.post('/appointments', { lawyerSlug: lawyer.slug, startsAt, mode, reason: reason.trim(), consent: true });
      toast.success('Appointment requested. You will see its status under Appointments.');
      onClose();
      navigate('/client/appointments');
    } catch (err) {
      if (err?.code === 'slot_taken') { setNote('Someone just booked that time. Please choose another.'); setStartsAt(''); slots.reload(); }
      else if (err?.fields) setErrors(err.fields); else setNote(errorMessage(err));
    } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} size="lg" title={`Request an appointment with ${lawyer.name}`} description={`Times are shown in your time zone (${viewerTimeZone()}). The lawyer must confirm your request.`}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" form="appt-form" loading={busy}>Request appointment</Button></>}>
      <form id="appt-form" onSubmit={submit} className="space-y-5" noValidate>
        {note ? <Alert tone="danger">{note}</Alert> : null}
        {slots.loading ? <Skeleton className="h-24 w-full" /> : slots.error ? <Alert tone="danger">{slots.error.message}</Alert> : !all.length ? (
          <Alert tone="warning">This lawyer has no bookable times right now. You can send a message instead.</Alert>
        ) : (
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-navy-900">Choose a day and time</legend>
            <div className="mb-3 flex flex-wrap gap-2">
              {days.slice(0, 14).map((d) => (
                <button key={d} type="button" aria-pressed={today === d} onClick={() => { setDay(d); setStartsAt(''); }}
                  className={`min-h-10 rounded-lg px-3 text-sm ring-1 ${today === d ? 'bg-navy-900 text-white ring-navy-900' : 'bg-white text-navy-900 ring-navy-200 hover:bg-navy-50'}`}>
                  {formatDate(`${d}T12:00:00`, { weekday: 'short', day: 'numeric', month: 'short' })}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {forDay.map((s) => (
                <button key={s.startsAt} type="button" aria-pressed={startsAt === s.startsAt} onClick={() => { setStartsAt(s.startsAt); setErrors((x) => ({ ...x, startsAt: undefined })); }}
                  className={`min-h-10 rounded-lg px-3 text-sm ring-1 ${startsAt === s.startsAt ? 'bg-gold-400 font-semibold text-navy-950 ring-gold-500' : 'bg-white text-navy-900 ring-navy-200 hover:bg-gold-50'}`}>
                  {formatTime(s.startsAt)}
                </button>
              ))}
            </div>
            {errors.startsAt ? <p className="mt-1.5 text-sm font-medium text-red-700" role="alert">{errors.startsAt}</p> : null}
          </fieldset>
        )}
        <RadioGroup legend="Consultation method" name="mode" inline value={mode} error={errors.mode} onChange={setMode} options={modes.map((m) => ({ value: m, label: MODE_LABELS[m] ?? m }))}
          hint="Video calls are not built into the platform: for online appointments the lawyer shares their own meeting link or instructions once confirmed." />
        <TextAreaField label="Reason for the consultation" required maxLength={1000} rows={4} value={reason} error={errors.reason} onChange={(e) => setReason(e.target.value)} hint="General terms only. Don’t include confidential details." />
        <CheckboxField checked={consent} error={errors.consent} onChange={(e) => setConsent(e.target.checked)} label={`I agree that ${lawyer.name} can see my name and this reason for the consultation.`} />
      </form>
    </Modal>
  );
}
