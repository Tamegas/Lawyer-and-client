import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { LawyerCard } from '../../components/lawyers/LawyerCard.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { CheckboxField, SelectField, TextField } from '../../components/ui/Fields.jsx';
import { Alert, EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback.jsx';
import { Icon } from '../../components/ui/Icon.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { Container, PageHeader } from '../../components/ui/Primitives.jsx';
import { useReferenceOptions } from '../../context/ReferenceContext.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useDebounced, useDocumentTitle } from '../../hooks/usePage.js';
import { EXPERIENCE_OPTIONS, MODE_LABELS, SORT_OPTIONS } from '../../lib/labels.js';

const PAGE_SIZE = 9;
const KEYS = ['q', 'category', 'location', 'minExperience', 'minFee', 'maxFee', 'language', 'available', 'verified', 'mode', 'sort'];

function Filters({ params, set, draft, setDraft, refs }) {
  return (
    <div className="space-y-4">
      <SelectField label="Legal specialisation" placeholder="All specialisations" value={params.get('category') ?? ''} options={refs.categorySlugOptions} onChange={(e) => set({ category: e.target.value })} />
      <SelectField label="City or region" placeholder="Anywhere" value={params.get('location') ?? ''} options={refs.locationOptions} onChange={(e) => set({ location: e.target.value })} />
      <SelectField label="Experience" value={params.get('minExperience') ?? ''} options={EXPERIENCE_OPTIONS} onChange={(e) => set({ minExperience: e.target.value })} />
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-navy-900">Consultation fee (ETB)</legend>
        <div className="grid grid-cols-2 gap-2">
          <TextField label="Min" type="number" min="0" inputMode="numeric" value={draft.minFee} onChange={(e) => setDraft({ ...draft, minFee: e.target.value })} />
          <TextField label="Max" type="number" min="0" inputMode="numeric" value={draft.maxFee} onChange={(e) => setDraft({ ...draft, maxFee: e.target.value })} />
        </div>
        <p className="mt-1 text-xs text-navy-600">Lawyers who show “Contact for pricing” are left out when a fee range is set.</p>
      </fieldset>
      <SelectField label="Language" placeholder="Any language" value={params.get('language') ?? ''} options={refs.languageOptions} onChange={(e) => set({ language: e.target.value })} />
      <SelectField label="Consultation method" placeholder="Online or in person" value={params.get('mode') ?? ''} options={Object.entries(MODE_LABELS).map(([value, label]) => ({ value, label }))} onChange={(e) => set({ mode: e.target.value })} />
      <CheckboxField label="Available to book" hint="Taking new clients and has published weekly hours" checked={params.get('available') === 'true'} onChange={(e) => set({ available: e.target.checked ? 'true' : '' })} />
      <CheckboxField label="Verified credentials only" hint="Reviewed by an administrator" checked={params.get('verified') === 'true'} onChange={(e) => set({ verified: e.target.checked ? 'true' : '' })} />
    </div>
  );
}

export default function FindLawyer() {
  useDocumentTitle('Find a lawyer');
  const [params, setParams] = useSearchParams();
  const refs = useReferenceOptions();
  const [drawer, setDrawer] = useState(false);
  const urlDraft = { q: params.get('q') ?? '', minFee: params.get('minFee') ?? '', maxFee: params.get('maxFee') ?? '' };
  const [draft, setDraft] = useState(urlDraft);

  const set = (patch) => setParams((prev) => {
    const next = new URLSearchParams(prev);
    Object.entries(patch).forEach(([k, v]) => { if (v === '' || v == null) next.delete(k); else next.set(k, String(v)); });
    if (!('page' in patch)) next.delete('page');
    return next;
  }, { replace: true });

  // URL → draft (back button, "clear all"); draft → URL (debounced typing)
  useEffect(() => { setDraft({ q: params.get('q') ?? '', minFee: params.get('minFee') ?? '', maxFee: params.get('maxFee') ?? '' }); }, [params.get('q'), params.get('minFee'), params.get('maxFee')]); // eslint-disable-line react-hooks/exhaustive-deps
  const dq = useDebounced(draft.q, 350);
  const dmin = useDebounced(draft.minFee, 500);
  const dmax = useDebounced(draft.maxFee, 500);
  useEffect(() => {
    const patch = {};
    if (dq !== urlDraft.q) patch.q = dq.trim();
    if (dmin !== urlDraft.minFee) patch.minFee = dmin;
    if (dmax !== urlDraft.maxFee) patch.maxFee = dmax;
    if (Object.keys(patch).length) set(patch);
  }, [dq, dmin, dmax]); // eslint-disable-line react-hooks/exhaustive-deps

  const page = Math.max(1, Number(params.get('page')) || 1);
  const apiParams = useMemo(() => {
    const p = { page, pageSize: PAGE_SIZE };
    KEYS.forEach((k) => { const v = params.get(k); if (v) p[k] = v; });
    return p;
  }, [params, page]);
  const { data, error, loading, reload } = useApi('/lawyers', { params: apiParams });
  const ratingsAvailable = data?.ratingsAvailable ?? false;

  const chips = [];
  const label = (list, value) => list.find((o) => String(o.value) === String(value))?.label ?? value;
  if (params.get('q')) chips.push(['q', `“${params.get('q')}”`]);
  if (params.get('category')) chips.push(['category', label(refs.categorySlugOptions, params.get('category'))]);
  if (params.get('location')) chips.push(['location', label(refs.locationOptions, params.get('location'))]);
  if (params.get('minExperience')) chips.push(['minExperience', `${params.get('minExperience')}+ years`]);
  if (params.get('minFee')) chips.push(['minFee', `From ${params.get('minFee')} ETB`]);
  if (params.get('maxFee')) chips.push(['maxFee', `Up to ${params.get('maxFee')} ETB`]);
  if (params.get('language')) chips.push(['language', params.get('language')]);
  if (params.get('mode')) chips.push(['mode', MODE_LABELS[params.get('mode')]]);
  if (params.get('available') === 'true') chips.push(['available', 'Available to book']);
  if (params.get('verified') === 'true') chips.push(['verified', 'Verified only']);
  const clearAll = () => setParams({}, { replace: true });

  const sort = params.get('sort') ?? 'relevance';
  const filters = <Filters params={params} set={set} draft={draft} setDraft={setDraft} refs={refs} />;

  return (
    <Container className="py-10">
      <PageHeader eyebrow="Directory" title="Find a lawyer" description="Search by name or keyword, then narrow by specialisation, location, language, fees and more. Everything you choose stays in the address, so you can share the results." />
      <div className="grid gap-8 lg:grid-cols-[18rem_1fr]">
        <aside className="hidden lg:block" aria-label="Filters">
          <div className="sticky top-24 space-y-4 rounded-2xl bg-white p-5 shadow-card ring-1 ring-navy-100">
            <TextField label="Search" type="search" placeholder="Name, specialty, keyword" value={draft.q} onChange={(e) => setDraft({ ...draft, q: e.target.value })} />
            {filters}
          </div>
        </aside>

        <div>
          <div className="mb-4 flex flex-wrap items-end gap-3 lg:hidden">
            <div className="min-w-0 flex-1"><TextField label="Search" type="search" placeholder="Name, specialty, keyword" value={draft.q} onChange={(e) => setDraft({ ...draft, q: e.target.value })} /></div>
            <Button variant="secondary" icon="filter" onClick={() => setDrawer(true)}>Filters{chips.length ? ` (${chips.length})` : ''}</Button>
          </div>

          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-navy-700" aria-live="polite" role="status">
              {loading ? 'Searching…' : error ? '' : `${data?.total ?? 0} ${data?.total === 1 ? 'lawyer' : 'lawyers'} found`}
            </p>
            <div className="w-56">
              <SelectField label="Sort by" value={sort} onChange={(e) => set({ sort: e.target.value === 'relevance' ? '' : e.target.value })}
                options={SORT_OPTIONS.map((o) => (o.value === 'rating' && !ratingsAvailable ? { ...o, label: 'Highest rated (no reviews yet)', disabled: true } : o))} />
            </div>
          </div>
          {!ratingsAvailable && !loading ? <p className="mb-3 text-xs text-navy-600">“Highest rated” becomes available once clients have published genuine reviews.</p> : null}

          {chips.length ? (
            <ul className="mb-5 flex flex-wrap items-center gap-2" aria-label="Active filters">
              {chips.map(([key, text]) => (
                <li key={key}><button type="button" onClick={() => set({ [key]: '' })} className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-navy-100 px-3 text-xs font-medium text-navy-900 hover:bg-navy-200" aria-label={`Remove filter ${text}`}>{text}<Icon name="x" className="h-3.5 w-3.5" /></button></li>
              ))}
              <li><button type="button" onClick={clearAll} className="text-xs font-medium underline underline-offset-4">Clear all</button></li>
            </ul>
          ) : null}

          {loading ? <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-80 w-full rounded-2xl" />)}</div>
            : error ? <ErrorState message={error.message} onRetry={reload} />
              : !data?.lawyers?.length ? (
                <EmptyState icon="search" title="No lawyers match these filters" description="Try removing a filter, or describe your situation and we will suggest suitable professionals."
                  action={<div className="flex flex-wrap justify-center gap-2">{chips.length ? <Button variant="secondary" onClick={clearAll}>Clear all filters</Button> : null}<Button to="/describe-problem">Describe my legal problem</Button></div>} />
              ) : (
                <>
                  <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{data.lawyers.map((l) => <LawyerCard key={l.id} lawyer={l} />)}</div>
                  <div className="mt-8"><Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={(p) => { set({ page: p }); window.scrollTo({ top: 0, behavior: 'smooth' }); }} /></div>
                </>
              )}
          <Alert className="mt-10" tone="info">Fees shown are consultation fees listed by each lawyer. The full cost depends on the scope of work: <Link to="/fee-assistant" className="font-medium underline">use the Fee Discussion Assistant</Link> to ask for an itemised quotation.</Alert>
        </div>
      </div>

      <Modal open={drawer} onClose={() => setDrawer(false)} title="Filters" size="md" footer={<><Button variant="ghost" onClick={clearAll}>Clear all</Button><Button onClick={() => setDrawer(false)}>Show results</Button></>}>
        {filters}
      </Modal>
    </Container>
  );
}
