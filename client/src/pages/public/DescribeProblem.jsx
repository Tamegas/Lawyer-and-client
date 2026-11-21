import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { LawyerCard } from '../../components/lawyers/LawyerCard.jsx';
import { Alert } from '../../components/ui/Feedback.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { CheckboxField, SelectField, TextAreaField, TextField } from '../../components/ui/Fields.jsx';
import { Card, Container, PageHeader } from '../../components/ui/Primitives.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useReference, useReferenceOptions } from '../../context/ReferenceContext.jsx';
import { useForm } from '../../hooks/useForm.js';
import { useDocumentTitle } from '../../hooks/usePage.js';
import { api, errorMessage } from '../../lib/api.js';
import { todayIso } from '../../lib/format.js';
import { CONSULT_PREFERENCE_LABELS, HELP_TYPE_LABELS } from '../../lib/labels.js';

const num = (v) => (v === '' || v == null ? '' : Number(v));

export default function DescribeProblem() {
  useDocumentTitle('Describe my legal problem');
  const { user, promptAuth } = useAuth();
  const { categorySlugOptions, categories, locationOptions, languageOptions } = useReferenceOptions();
  const { data: ref } = useReference();
  const [params] = useSearchParams();
  const form = useForm({ categoryId: '', summary: '', locationId: '', issueStartedOn: '', hasUrgentDeadline: false, deadlineOn: '', helpType: 'consultation', preferredLanguage: '', consultationPreference: 'either', budgetMin: '', budgetMax: '', privacyAcknowledged: false });
  const v = form.values;
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [result, setResult] = useState(null);

  useEffect(() => {
    const slug = params.get('category');
    const c = categories.find((x) => x.slug === slug);
    if (c && !form.values.categoryId) form.setValue('categoryId', String(c.id));
  }, [categories]); // eslint-disable-line react-hooks/exhaustive-deps

  const helpOptions = (ref?.helpTypes ?? Object.keys(HELP_TYPE_LABELS)).map((h) => ({ value: h, label: HELP_TYPE_LABELS[h] ?? h }));
  const consultOptions = (ref?.consultPreferences ?? Object.keys(CONSULT_PREFERENCE_LABELS)).map((h) => ({ value: h, label: CONSULT_PREFERENCE_LABELS[h] ?? h }));
  const categoryOptions = categories.map((c) => ({ value: String(c.id), label: c.name }));

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setNote('');
    const errs = {};
    if (!v.categoryId) errs.categoryId = 'Choose the type of legal problem';
    if (v.summary.trim().length < 20) errs.summary = 'Please write at least 20 characters so lawyers can understand the situation';
    if (v.deadlineOn && !v.hasUrgentDeadline) errs.hasUrgentDeadline = 'Tick this box if you have a deadline or court date';
    if (v.budgetMin !== '' && v.budgetMax !== '' && Number(v.budgetMax) < Number(v.budgetMin)) errs.budgetMax = 'Maximum budget must be at least the minimum';
    if (!v.privacyAcknowledged) errs.privacyAcknowledged = 'Please confirm that you have read the privacy notice';
    form.setErrors(errs);
    if (Object.keys(errs).length) return;

    let who = user;
    if (!who) who = await promptAuth({ mode: 'register', role: 'client', message: 'Create a free account (or sign in) to save your request and see suggested lawyers. Everything you typed is kept.' });
    if (!who) return;
    if (who.role !== 'client') { setNote('Only client accounts can submit legal requests.'); return; }

    setBusy(true);
    try {
      const body = { ...v, categoryId: Number(v.categoryId), summary: v.summary.trim(), locationId: num(v.locationId), budgetMin: num(v.budgetMin), budgetMax: num(v.budgetMax) };
      setResult(await api.post('/requests', body));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      if (!form.applyError(err)) setNote(errorMessage(err));
    } finally { setBusy(false); }
  };

  if (user && user.role !== 'client') {
    return <Container narrow className="py-12"><PageHeader title="Describe my legal problem" /><Alert tone="info" title="This form is for clients">You are signed in as a {user.role}. Client accounts describe their situation to find lawyers.</Alert></Container>;
  }

  if (result) {
    return (
      <Container className="py-10">
        <PageHeader eyebrow="Request saved" title="Possibly relevant legal professionals" description="Nothing has been sent to any lawyer. Open a profile to learn more, then choose whether to contact someone and what to share." actions={<Button to={`/client/requests/${result.request.id}`} variant="secondary">View my request</Button>} />
        {result.matches?.length ? (
          <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{result.matches.map((l) => <li key={l.id}><LawyerCard lawyer={l} matchReasons={l.match?.reasons} /></li>)}</ul>
        ) : <Alert tone="info" title="No published lawyers in this category yet">Browse the full directory or check back soon.</Alert>}
        <Alert className="mt-8" tone="warning" title="This is an organising and matching tool">It is not legal advice and not a substitute for a qualified lawyer. The suggestions only reflect the information you entered and what each lawyer published.</Alert>
        <div className="mt-6"><Button to="/lawyers" variant="secondary">Browse all lawyers</Button></div>
      </Container>
    );
  }

  return (
    <Container narrow className="py-10">
      <PageHeader eyebrow="Guided form" title="Describe my legal problem" description="Tell us about your situation in general terms and we will suggest legal professionals who may be able to help. It takes about three minutes." />
      <Alert tone="warning" className="mb-6" title="Please don’t share sensitive details here">
        Do not enter national ID numbers, passwords, bank details or confidential documents. There is no file upload. Describe the situation in general terms and share more later, directly with a lawyer you choose.
      </Alert>
      <form onSubmit={submit} className="space-y-6" noValidate>
        {note ? <Alert tone="danger">{note}</Alert> : null}
        <Card className="space-y-5">
          <h2 className="text-lg font-semibold">1. The problem</h2>
          <SelectField label="What type of legal problem are you facing?" required placeholder="Choose a category" options={categoryOptions} {...form.bind('categoryId')} />
          <TextAreaField label="Brief description of the issue" required rows={6} maxLength={3000} hint="Who is involved (no need for names), what happened and what you hope to achieve." {...form.bind('summary')} />
        </Card>
        <Card className="space-y-5">
          <h2 className="text-lg font-semibold">2. Where and when</h2>
          <SelectField label="Where is the issue located?" placeholder="Choose a city or region" options={locationOptions} {...form.bind('locationId')} />
          <TextField label="When did the issue begin?" type="date" max={todayIso()} {...form.bind('issueStartedOn')} />
          <CheckboxField label="There is an urgent deadline or court date" checked={v.hasUrgentDeadline} error={form.errors.hasUrgentDeadline} onChange={(e) => form.setValue('hasUrgentDeadline', e.target.checked)} />
          {v.hasUrgentDeadline ? <TextField label="Deadline or court date" type="date" min={todayIso()} {...form.bind('deadlineOn')} /> : null}
        </Card>
        <Card className="space-y-5">
          <h2 className="text-lg font-semibold">3. The help you need</h2>
          <SelectField label="What kind of legal help do you need?" options={helpOptions} {...form.bind('helpType')} />
          <div className="grid gap-5 sm:grid-cols-2">
            <SelectField label="Preferred language" placeholder="No preference" options={languageOptions} {...form.bind('preferredLanguage')} />
            <SelectField label="Preferred consultation method" options={consultOptions} {...form.bind('consultationPreference')} />
          </div>
          <fieldset><legend className="mb-1.5 text-sm font-medium text-navy-900">Budget range for a consultation (ETB, optional)</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Minimum" type="number" min="0" inputMode="decimal" {...form.bind('budgetMin')} />
              <TextField label="Maximum" type="number" min="0" inputMode="decimal" {...form.bind('budgetMax')} />
            </div></fieldset>
        </Card>
        <Card className="space-y-4">
          <CheckboxField checked={v.privacyAcknowledged} error={form.errors.privacyAcknowledged} onChange={(e) => form.setValue('privacyAcknowledged', e.target.checked)}
            label={<>I have read the <Link to="/privacy" target="_blank" className="underline">privacy notice</Link> and understand that this request is saved to my account.</>}
            hint="Submitting does not send anything to any lawyer. Your request stays private unless you choose to share it with a specific lawyer." />
          <Button type="submit" variant="gold" size="lg" loading={busy}>Find relevant lawyers</Button>
          {!user ? <p className="text-xs text-navy-600">You’ll be asked to create a free account or sign in when you submit. What you typed is kept.</p> : null}
        </Card>
      </form>
      <p className="mt-6 text-xs text-navy-600">This tool helps you organise your issue and find professionals. It does not provide legal advice or replace a qualified lawyer.</p>
    </Container>
  );
}
