import { useState } from 'react';
import { ReportDialog } from '../reports/ReportDialog.jsx';
import { Alert, Loadable } from '../ui/Feedback.jsx';
import { Button } from '../ui/Button.jsx';
import { TextAreaField } from '../ui/Fields.jsx';
import { StarInput, Stars } from '../ui/Stars.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useApi } from '../../hooks/useApi.js';
import { api, errorMessage } from '../../lib/api.js';
import { formatDate } from '../../lib/format.js';

function ReviewForm({ appointmentId, onDone }) {
  const toast = useToast();
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState('');
  const [errors, setErrors] = useState({});
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    const next = {};
    if (!rating) next.rating = 'Choose a star rating';
    if (body.trim().length < 20) next.body = 'Please write at least 20 characters';
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true); setNote('');
    try {
      await api.post('/reviews', { appointmentId, rating, body: body.trim() });
      toast.success('Thank you. Your review was submitted.');
      onDone();
    } catch (err) {
      if (err?.fields) setErrors(err.fields); else setNote(errorMessage(err));
    } finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="mt-6 space-y-4 rounded-2xl bg-navy-50 p-5" noValidate>
      <h3 className="text-lg font-semibold">Write a review</h3>
      <Alert tone="warning">Do not include confidential case details, names of other people, contact details or accusations. Reviews with contact details are rejected, and any review can be reported.</Alert>
      {note ? <Alert tone="danger">{note}</Alert> : null}
      <StarInput value={rating} onChange={(v) => { setRating(v); setErrors((x) => ({ ...x, rating: undefined })); }} error={errors.rating} />
      <TextAreaField label="Your experience" required maxLength={2000} rows={5} value={body} error={errors.body} onChange={(e) => setBody(e.target.value)} />
      <Button type="submit" loading={busy}>Submit review</Button>
    </form>
  );
}

export function ReviewsSection({ lawyer, user }) {
  const reviews = useApi(`/reviews/lawyer/${lawyer.slug}`);
  const isClient = user?.role === 'client';
  const elig = useApi(`/reviews/eligibility/${lawyer.slug}`, { enabled: isClient });
  const [report, setReport] = useState(null);
  const summary = reviews.data?.summary;
  const list = reviews.data?.reviews ?? [];

  return (
    <section aria-labelledby="reviews-h" className="scroll-mt-24">
      <h2 id="reviews-h" className="text-2xl font-semibold">Reviews</h2>
      <Loadable loading={reviews.loading} error={reviews.error} onRetry={reviews.reload}>
        {summary?.count ? (
          <div className="mt-4 flex flex-wrap items-center gap-6 rounded-2xl bg-white p-5 shadow-card ring-1 ring-navy-100">
            <div><p className="font-serif text-4xl font-semibold">{summary.average}</p><Stars value={summary.average} count={summary.count} /></div>
            <ul className="min-w-[12rem] flex-1 space-y-1 text-xs" aria-label="Rating distribution">
              {[5, 4, 3, 2, 1].map((n) => (
                <li key={n} className="flex items-center gap-2"><span className="w-10">{n} star{n > 1 ? 's' : ''}</span>
                  <span className="h-2 flex-1 rounded-full bg-navy-100"><span className="block h-2 rounded-full bg-gold-500" style={{ width: `${((summary.distribution?.[n] ?? 0) / summary.count) * 100}%` }} /></span>
                  <span className="w-6 text-right">{summary.distribution?.[n] ?? 0}</span></li>
              ))}
            </ul>
          </div>
        ) : <p className="mt-3 text-sm text-navy-700">No reviews yet. Only clients who completed an appointment with this lawyer can leave one.</p>}
        <ul className="mt-5 space-y-4">
          {list.map((r) => (
            <li key={r.id} className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-navy-100">
              <div className="flex flex-wrap items-center justify-between gap-2"><Stars value={r.rating} size="sm" /><span className="text-xs text-navy-600">{formatDate(r.createdAt)}</span></div>
              <p className="mt-2 whitespace-pre-line text-sm leading-6 text-navy-900">{r.body}</p>
              <div className="mt-3 flex items-center justify-between text-xs text-navy-600"><span>{r.author}</span>
                <button type="button" className="underline underline-offset-4 hover:text-navy-950" onClick={() => setReport(r)}>Report this review</button></div>
            </li>
          ))}
        </ul>
      </Loadable>

      {isClient ? (
        elig.data?.eligible ? <ReviewForm appointmentId={elig.data.appointmentId} onDone={() => { reviews.reload(); elig.reload(); }} />
          : elig.data ? <p className="mt-5 text-sm text-navy-700">{elig.data.reason || 'You can review this lawyer after a completed appointment with them.'}</p> : null
      ) : !user ? <p className="mt-5 text-sm text-navy-700">Sign in as a client with a completed appointment to leave a review.</p> : null}
      <ReportDialog open={Boolean(report)} onClose={() => setReport(null)} targetType="review" targetId={report?.id} targetLabel="this review" />
    </section>
  );
}
