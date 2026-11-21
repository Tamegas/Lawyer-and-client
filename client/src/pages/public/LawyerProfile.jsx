import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { AppointmentDialog } from '../../components/profile/AppointmentDialog.jsx';
import { ContactDialog } from '../../components/profile/ContactDialog.jsx';
import { EstimateDialog } from '../../components/profile/EstimateDialog.jsx';
import { ReviewsSection } from '../../components/profile/ReviewsSection.jsx';
import { Avatar } from '../../components/lawyers/Avatar.jsx';
import { ReportDialog } from '../../components/reports/ReportDialog.jsx';
import { Badge, StatusBadge } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Alert, EmptyState, ErrorState, PageLoader } from '../../components/ui/Feedback.jsx';
import { Icon } from '../../components/ui/Icon.jsx';
import { Stars } from '../../components/ui/Stars.jsx';
import { Card, Container, DescriptionList } from '../../components/ui/Primitives.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useDocumentTitle } from '../../hooks/usePage.js';
import { api, errorMessage } from '../../lib/api.js';
import { formatDate, formatFee, formatMoney, joinList, plural } from '../../lib/format.js';
import { MODE_LABELS, WEEKDAYS, WEEKDAY_ORDER, evidenceInfo, profileStatusInfo, verificationInfo } from '../../lib/labels.js';

function Section({ id, title, children }) {
  return <section aria-labelledby={`${id}-h`} className="scroll-mt-24"><h2 id={`${id}-h`} className="mb-4 text-2xl font-semibold">{title}</h2>{children}</section>;
}

export default function LawyerProfile() {
  const { slug } = useParams();
  const [search, setSearch] = useSearchParams();
  const { user, promptAuth } = useAuth();
  const toast = useToast();
  const { data, error, loading, reload, setData } = useApi(`/lawyers/${slug}`);
  const lawyer = data?.lawyer;
  useDocumentTitle(lawyer ? `${lawyer.name} · ${lawyer.title ?? 'Lawyer'}` : 'Lawyer profile');

  const [dialog, setDialog] = useState(null); // 'contact' | 'estimate' | 'appointment'
  const [reportTarget, setReportTarget] = useState(null); // { type, id, label }
  const [saving, setSaving] = useState(false);

  const act = useCallback(async (name) => {
    let who = user;
    if (!who) who = await promptAuth({ mode: 'register', role: 'client', message: 'Create a free account (or sign in) to contact lawyers. Your profile page stays open.' });
    if (!who) return;
    if (who.role !== 'client') { toast.info('Only client accounts can contact lawyers, request estimates or book appointments.'); return; }
    setDialog(name);
  }, [user, promptAuth, toast]);

  const handled = useRef(false);
  useEffect(() => {
    const wanted = search.get('action');
    if (!wanted || handled.current || !lawyer || user === undefined) return;
    handled.current = true;
    if (['contact', 'estimate', 'appointment'].includes(wanted)) act(wanted);
    const next = new URLSearchParams(search); next.delete('action'); setSearch(next, { replace: true });
  }, [lawyer, user, search, setSearch, act]);

  const toggleSave = async () => {
    if (!user) { await act('contact'); setDialog(null); return; }
    if (user.role !== 'client' || saving) return;
    setSaving(true);
    try {
      if (lawyer.saved) await api.delete(`/me/saved/${lawyer.id}`); else await api.put(`/me/saved/${lawyer.id}`);
      setData((d) => ({ ...d, lawyer: { ...d.lawyer, saved: !d.lawyer.saved } }));
      toast.success(lawyer.saved ? 'Removed from saved lawyers.' : 'Saved to your list.');
    } catch (err) { toast.error(errorMessage(err)); } finally { setSaving(false); }
  };

  if (loading) return <Container className="py-10"><PageLoader /></Container>;
  if (error) {
    return <Container narrow className="py-16">{error.status === 404
      ? <EmptyState icon="search" title="This profile isn’t available" description="It may have been removed, unpublished or the address may be wrong." action={<Button to="/lawyers">Browse lawyers</Button>} />
      : <ErrorState message={error.message} onRetry={reload} />}</Container>;
  }

  const verified = lawyer.verification?.status === 'verified';
  const isClient = user?.role === 'client';
  const notPublic = lawyer.profileStatus !== 'published';
  const hours = WEEKDAY_ORDER.map((d) => ({ d, ranges: (lawyer.availability ?? []).filter((a) => a.weekday === d) })).filter((x) => x.ranges.length);

  const actions = (
    <div className="space-y-3">
      <Button fullWidth variant="gold" icon="message" onClick={() => act('contact')}>Contact Lawyer</Button>
      <Button fullWidth variant="primary" icon="calendar" onClick={() => act('appointment')}>Request an appointment</Button>
      <Button fullWidth variant="secondary" icon="coins" onClick={() => act('estimate')}>Request a Fee Estimate</Button>
      {isClient || !user ? <Button fullWidth variant="ghost" icon="heart" loading={saving} onClick={toggleSave} aria-pressed={lawyer.saved}>{lawyer.saved ? 'Saved' : 'Save lawyer'}</Button> : null}
      {user && !isClient ? <p className="text-xs text-navy-600">Contact, appointment and estimate actions are for client accounts.</p> : null}
      <button type="button" className="w-full text-center text-xs text-navy-600 underline underline-offset-4 hover:text-navy-950" onClick={() => setReportTarget({ type: 'lawyer_profile', id: lawyer.id, label: 'this profile' })}>Report this profile</button>
    </div>
  );

  return (
    <Container className="pb-28 pt-8 lg:pb-12">
      {notPublic ? <Alert tone="warning" className="mb-6" title="This profile is not public">Status: {profileStatusInfo(lawyer.profileStatus).label}. Only you and administrators can see this page.</Alert> : null}

      <header className="rounded-3xl bg-navy-950 p-6 text-white shadow-lift sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <Avatar name={lawyer.name} size="lg" />
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-semibold !text-white">{lawyer.name}</h1>
            <p className="mt-1 text-navy-200">{lawyer.title || 'Legal professional'}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <StatusBadge info={verificationInfo(lawyer.verification?.status)} />
              {lawyer.isDemo ? <Badge tone="gold">Demo profile · fictional</Badge> : null}
              {lawyer.acceptingNewClients ? <Badge tone="success">Accepting new clients</Badge> : <Badge>Not taking new clients</Badge>}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-navy-200">
              {lawyer.yearsExperience != null ? <span>{plural(lawyer.yearsExperience, 'year')} of experience</span> : null}
              {lawyer.location?.name ? <span className="inline-flex items-center gap-1"><Icon name="map-pin" className="h-4 w-4" />{lawyer.location.name}</span> : null}
              {lawyer.languages?.length ? <span className="inline-flex items-center gap-1"><Icon name="globe" className="h-4 w-4" />{joinList(lawyer.languages)}</span> : null}
              <span>{lawyer.rating ? <Stars value={lawyer.rating.average} count={lawyer.rating.count} size="sm" /> : 'No reviews yet'}</span>
            </div>
          </div>
        </div>
        {lawyer.isDemo ? <p className="mt-5 rounded-lg bg-white/10 p-3 text-sm text-navy-100">This is a fictional demonstration profile. The person, qualifications, cases and fees are invented and not real.</p> : null}
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-12">
          <Section id="about" title="About">
            <p className="whitespace-pre-line text-[15px] leading-7 text-navy-800">{lawyer.bio || 'This lawyer has not added a biography yet.'}</p>
            <Card className="mt-5"><DescriptionList items={[
              { label: 'Qualifications and education', value: lawyer.qualifications },
              { label: 'Practice areas', value: lawyer.specializations?.length ? joinList(lawyer.specializations.map((s) => s.name)) : 'None listed yet' },
              { label: 'Languages', value: joinList(lawyer.languages ?? []) },
              { label: 'Office', value: [lawyer.location?.name, lawyer.officeAddress].filter(Boolean).join(' · ') || null },
              { label: 'Consultation options', value: lawyer.consultationModes?.length ? joinList(lawyer.consultationModes.map((m) => MODE_LABELS[m] ?? m)) : 'Not stated' },
              { label: 'Professional licence', value: verified && lawyer.verification.license
                ? `Reviewed by an administrator. Issuing body: ${lawyer.verification.license.issuingBody ?? 'not stated'}${lawyer.verification.license.validUntil ? ` · valid until ${formatDate(lawyer.verification.license.validUntil)}` : ''}`
                : 'A licence has not been verified on this platform.' },
              { label: 'Verification', value: verificationInfo(lawyer.verification?.status).hint },
              { label: 'Contact', value: lawyer.contact?.email || lawyer.contact?.phone ? <span>{[lawyer.contact.email, lawyer.contact.phone].filter(Boolean).join(' · ')} <span className="text-xs text-navy-600">(published by the lawyer)</span></span> : 'Contact through secure in-app messages. This lawyer has not published an email or phone number.' },
            ]} /></Card>
          </Section>

          <Section id="cases" title="Case Experience and Outcomes">
            <Alert tone="info" className="mb-4">Case summaries are written by the lawyer, subject to client confidentiality and professional rules, and contain no identifying details. They are not a prediction or guarantee of any result. Each one shows how well it is documented.</Alert>
            {lawyer.cases?.length ? (
              <ul className="space-y-4">
                {lawyer.cases.map((c) => {
                  const ev = evidenceInfo(c.evidenceLevel);
                  return (
                    <li key={c.id} className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-navy-100">
                      <div className="flex flex-wrap items-start justify-between gap-2"><h3 className="text-lg font-semibold">{c.title}</h3><StatusBadge info={ev} /></div>
                      <p className="mt-1 text-xs text-navy-600">{c.category?.name} · {c.year}{c.isDemo ? ' · fictional demonstration case' : ''}</p>
                      <p className="mt-3 text-sm leading-6 text-navy-800">{c.description}</p>
                      <DescriptionList className="mt-3" items={[{ label: 'Lawyer’s role', value: c.lawyerRole }, { label: 'Outcome', value: c.outcome || 'Not disclosed' }, { label: 'Public reference', value: c.publicReference }]} />
                      <p className="mt-2 text-xs text-navy-600">{ev.hint}</p>
                      <button type="button" className="mt-2 text-xs underline underline-offset-4 hover:text-navy-950" onClick={() => setReportTarget({ type: 'case', id: c.id, label: 'this case summary' })}>Report this case summary</button>
                    </li>
                  );
                })}
              </ul>
            ) : <p className="text-sm text-navy-700">No case summaries have been published for this lawyer.</p>}
          </Section>

          <Section id="pricing" title="Pricing">
            <Card>
              <DescriptionList items={[
                { label: 'Initial consultation fee', value: formatFee(lawyer.consultationFee, lawyer.currency) },
                { label: 'Hourly rate', value: lawyer.hourlyRate != null ? `${formatMoney(lawyer.hourlyRate, lawyer.currency)} per hour` : 'Not listed' },
                { label: 'Fees negotiable', value: lawyer.feeNegotiable ? 'The lawyer says fees may be negotiable' : 'Not stated' },
                { label: 'Payment plans', value: lawyer.paymentPlans ? 'Available, ask the lawyer for details' : 'Not stated' },
              ]} />
              {lawyer.fixedFeeServices?.length ? (
                <div className="mt-4"><h3 className="text-base font-semibold">Fixed-fee services</h3>
                  <ul className="mt-2 divide-y divide-navy-100 text-sm">{lawyer.fixedFeeServices.map((f) => (
                    <li key={f.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2.5"><span><span className="font-medium">{f.title}</span>{f.description ? <span className="block text-navy-600">{f.description}</span> : null}</span><span className="font-semibold">{formatMoney(f.amount, lawyer.currency)}</span></li>))}</ul></div>
              ) : null}
              <p className="mt-4 text-xs leading-5 text-navy-600">Fees are indicative. Every engagement is agreed directly with the lawyer, and no outcome is promised. <Link to="/fee-assistant" className="underline">How legal fees work</Link></p>
              <div className="mt-4"><Button variant="secondary" icon="coins" onClick={() => act('estimate')}>Request a Fee Estimate</Button></div>
            </Card>
          </Section>

          <Section id="availability" title="Availability">
            {hours.length ? (
              <Card><p className="mb-3 text-sm text-navy-700">Weekly hours ({lawyer.timezone ?? 'lawyer’s time zone'}). Bookable times in your own time zone appear when you request an appointment.</p>
                <ul className="grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">{hours.map(({ d, ranges }) => <li key={d} className="flex justify-between gap-3 border-b border-navy-100 py-1.5"><span className="font-medium">{WEEKDAYS[d]}</span><span>{ranges.map((r) => `${r.startTime}–${r.endTime}`).join(', ')}</span></li>)}</ul>
                <div className="mt-4"><Button variant="primary" icon="calendar" onClick={() => act('appointment')}>Request an appointment</Button></div></Card>
            ) : <p className="text-sm text-navy-700">This lawyer has not published weekly hours. You can still send a message.</p>}
          </Section>

          <ReviewsSection lawyer={lawyer} user={user} />

          <Alert tone="info" title="No legal advice, no guarantees">This platform does not give legal advice and does not guarantee any outcome. Please confirm credentials and terms directly with the lawyer before engaging them.</Alert>
        </div>

        <aside className="hidden lg:block" aria-label="Actions"><div className="sticky top-24 rounded-2xl bg-white p-5 shadow-lift ring-1 ring-navy-100">
          <p className="text-xs uppercase tracking-wide text-navy-600">Consultation fee</p>
          <p className="mb-4 font-serif text-2xl font-semibold">{formatFee(lawyer.consultationFee, lawyer.currency)}</p>{actions}</div></aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 flex gap-2 border-t border-navy-100 bg-white/95 p-3 backdrop-blur lg:hidden">
        <Button variant="gold" icon="message" className="flex-1" onClick={() => act('contact')}>Contact</Button>
        <Button variant="primary" icon="calendar" className="flex-1" onClick={() => act('appointment')}>Book</Button>
        <Button variant="secondary" icon="coins" aria-label="Request a fee estimate" onClick={() => act('estimate')} />
      </div>

      {dialog === 'contact' ? <ContactDialog open onClose={() => setDialog(null)} lawyer={lawyer} /> : null}
      {dialog === 'estimate' ? <EstimateDialog open onClose={() => setDialog(null)} lawyer={lawyer} /> : null}
      {dialog === 'appointment' ? <AppointmentDialog open onClose={() => setDialog(null)} lawyer={lawyer} /> : null}
      <ReportDialog open={Boolean(reportTarget)} onClose={() => setReportTarget(null)} targetType={reportTarget?.type} targetId={reportTarget?.id} targetLabel={reportTarget?.label} />
    </Container>
  );
}
