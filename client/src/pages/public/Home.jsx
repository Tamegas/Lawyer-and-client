import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LawyerCard } from '../../components/lawyers/LawyerCard.jsx';
import { Alert, EmptyState, Loadable, Skeleton } from '../../components/ui/Feedback.jsx';
import { SelectField } from '../../components/ui/Fields.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { CategoryIcon, Icon } from '../../components/ui/Icon.jsx';
import { Card, Container, Section, SectionHeading } from '../../components/ui/Primitives.jsx';
import { useReferenceOptions } from '../../context/ReferenceContext.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useDocumentTitle } from '../../hooks/usePage.js';
import { compact } from '../../lib/format.js';

const STEPS = [
  { icon: 'file-text', title: 'Describe your legal issue', text: 'Answer a few guided questions in plain language. No documents, no ID numbers.' },
  { icon: 'scale', title: 'Compare suitable legal professionals', text: 'See who works on your type of issue, their experience, languages and consultation fees.' },
  { icon: 'handshake', title: 'Contact a lawyer and discuss your case', text: 'Send a message or request an appointment. You decide what to share and with whom.' },
];

const TRUST = [
  { icon: 'shield-check', title: 'Professional verification', text: 'A lawyer is labelled “Verified” only after an administrator has manually reviewed submitted credentials. Profiles without that review are labelled “Not verified”. Not every lawyer here is verified.' },
  { icon: 'lock', title: 'Privacy and consent', text: 'Your legal request is never public. A lawyer can read it only after you choose to share it with them, and you can withdraw that access later. Verification documents are never public.' },
  { icon: 'star', title: 'Reviews you can rely on', text: 'Only clients with a completed appointment can review a lawyer, once per appointment. Reviews that contain contact details are rejected, and suspicious reviews can be reported.' },
  { icon: 'flag', title: 'Report anything suspicious', text: 'Profiles, reviews, case summaries and messages can be reported. Administrators review reports and can suspend accounts.' },
];

export default function Home() {
  useDocumentTitle('Find the right legal support');
  const navigate = useNavigate();
  const { categories, categorySlugOptions, locationOptions } = useReferenceOptions();
  const [form, setForm] = useState({ q: '', category: '', location: '' });
  const featured = useApi('/lawyers', { params: { pageSize: 3, sort: 'relevance' } });

  const submit = (e) => {
    e.preventDefault();
    const qs = new URLSearchParams(compact(form)).toString();
    navigate(`/lawyers${qs ? `?${qs}` : ''}`);
  };

  return (
    <>
      <section className="relative overflow-hidden bg-navy-950 text-white">
        <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(212,169,76,0.18),transparent_55%),radial-gradient(ellipse_at_bottom_left,rgba(74,107,156,0.35),transparent_55%)]" />
        <Container className="relative py-16 sm:py-24">
          <div className="max-w-3xl animate-fade-up">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.14em] text-gold-300 ring-1 ring-white/15"><Icon name="scale" className="h-3.5 w-3.5" />Legal support, made clearer</p>
            <h1 className="text-4xl font-semibold leading-tight !text-white sm:text-5xl">Find the Right Legal Support for Your Situation.</h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-navy-200">Connect with qualified legal professionals, explore their experience, understand consultation fees, and take the next step with confidence.</p>
          </div>
          <form onSubmit={submit} role="search" aria-label="Find a lawyer" className="mt-10 grid gap-3 rounded-2xl bg-white p-4 text-navy-900 shadow-lift sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_auto] lg:items-end">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-navy-900">Search</span>
              <span className="relative block"><Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-navy-400" />
                <input type="search" value={form.q} onChange={(e) => setForm({ ...form, q: e.target.value })} placeholder="Name, specialty or keyword"
                  className="min-h-11 w-full rounded-lg border border-navy-200 bg-white pl-10 pr-3 text-sm placeholder:text-navy-400 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-400/40" /></span>
            </label>
            <SelectField label="Legal category" placeholder="All categories" value={form.category} options={categorySlugOptions} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            <SelectField label="Location" placeholder="Anywhere" value={form.location} options={locationOptions} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            <Button type="submit" variant="gold" size="lg" icon="search" className="sm:col-span-2 lg:col-span-1">Find a Lawyer</Button>
          </form>
          <div className="mt-5"><Button to="/describe-problem" variant="secondary" size="lg" iconRight="arrow-right">Describe My Legal Problem</Button></div>
        </Container>
      </section>

      <Section>
          <SectionHeading eyebrow="Legal categories" title="Start with the kind of problem you have" description="Choose an area to see the lawyers who list it as a specialisation." />
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((c) => (
              <li key={c.id}>
                <Link to={`/lawyers?category=${c.slug}`} className="group flex h-full gap-4 rounded-2xl bg-white p-5 shadow-card ring-1 ring-navy-100 transition hover:-translate-y-0.5 hover:shadow-lift">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-navy-900 text-gold-300"><CategoryIcon slug={c.slug} className="h-5 w-5" /></span>
                  <span><span className="block font-serif text-lg font-semibold text-navy-950">{c.name}</span><span className="mt-1 block text-sm text-navy-700">{c.description}</span></span>
                </Link>
              </li>
            ))}
          </ul>
      </Section>

      <Section tone="muted">
          <SectionHeading eyebrow="How it works" title="Three simple steps" align="center" />
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="relative rounded-2xl bg-white p-6 shadow-card ring-1 ring-navy-100">
                <span className="absolute -top-3 left-6 rounded-full bg-gold-400 px-3 py-0.5 text-xs font-bold text-navy-950">Step {i + 1}</span>
                <Icon name={s.icon} className="mb-3 h-7 w-7 text-gold-700" />
                <h3 className="text-lg font-semibold">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-navy-700">{s.text}</p>
              </li>
            ))}
          </ol>
          <p className="mt-8 text-center text-sm"><Link to="/how-it-works" className="font-medium underline underline-offset-4">Read the full process, including how fees work</Link></p>
      </Section>

      <Section>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHeading eyebrow="Featured lawyers" title="Legal professionals on the platform" description="Early-stage directory. Profiles marked “Demo profile” are fictional and exist only to show how the platform works." />
            <Button to="/lawyers" variant="secondary" iconRight="arrow-right">Browse all lawyers</Button>
          </div>
          <div className="mt-8">
            <Loadable loading={featured.loading} error={featured.error} onRetry={featured.reload}
              skeleton={<div className="grid gap-5 md:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-80 w-full rounded-2xl" />)}</div>}
              isEmpty={!featured.data?.lawyers?.length}
              empty={<EmptyState icon="users" title="No lawyers are listed yet" description="Published lawyer profiles will appear here." action={<Button to="/describe-problem">Describe my legal problem</Button>} />}>
              <div className="grid gap-5 md:grid-cols-3">{featured.data?.lawyers?.map((l) => <LawyerCard key={l.id} lawyer={l} />)}</div>
            </Loadable>
          </div>
      </Section>

      <Section tone="navy">
          <SectionHeading eyebrow="Trust and safety" title="What the platform actually does" tone="dark" description="No guesses and no marketing claims: this is how the current version behaves." />
          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            {TRUST.map((t) => (
              <div key={t.title} className="flex gap-4 rounded-2xl bg-white/5 p-6 ring-1 ring-white/10">
                <Icon name={t.icon} className="h-7 w-7 shrink-0 text-gold-300" />
                <div><h3 className="text-lg font-semibold !text-white">{t.title}</h3><p className="mt-1.5 text-sm leading-6 text-navy-200">{t.text}</p></div>
              </div>
            ))}
          </div>
      </Section>

      <Section>
        <div className="mx-auto max-w-3xl">
          <Alert tone="info" title="This platform does not give legal advice">
            It helps you organise your issue and find legal professionals. It cannot replace a qualified lawyer, and it does not promise or predict any outcome.
          </Alert>
        </div>
      </Section>
    </>
  );
}
