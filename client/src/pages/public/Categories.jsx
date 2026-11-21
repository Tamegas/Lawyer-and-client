import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button.jsx';
import { Alert, Loadable } from '../../components/ui/Feedback.jsx';
import { CategoryIcon } from '../../components/ui/Icon.jsx';
import { Container, PageHeader } from '../../components/ui/Primitives.jsx';
import { useReference } from '../../context/ReferenceContext.jsx';
import { useDocumentTitle } from '../../hooks/usePage.js';

export default function Categories() {
  useDocumentTitle('Legal categories');
  const { data, loading, error, reload } = useReference();
  return (
    <Container className="py-10">
      <PageHeader eyebrow="Legal categories" title="What kind of legal issue do you have?" description="These plain-language descriptions are general. They are not legal advice, and which category fits your situation is something a lawyer can confirm." />
      <Loadable loading={loading} error={error} onRetry={reload}>
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {data?.categories?.map((c) => (
            <li key={c.id} className="flex flex-col rounded-2xl bg-white p-6 shadow-card ring-1 ring-navy-100">
              <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-navy-900 text-gold-300"><CategoryIcon slug={c.slug} className="h-6 w-6" /></span>
              <h2 className="text-xl font-semibold">{c.name}</h2>
              <p className="mt-2 flex-1 text-sm leading-6 text-navy-700">{c.description}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button to={`/lawyers?category=${c.slug}`} size="sm" variant="primary">Find lawyers</Button>
                <Button to={`/describe-problem?category=${c.slug}`} size="sm" variant="secondary">Describe my problem</Button>
              </div>
            </li>
          ))}
        </ul>
      </Loadable>
      <Alert className="mt-10" tone="info" title="Not sure which category fits?">Pick the closest one, or choose “Other Legal Issues”. You can <Link to="/describe-problem" className="font-medium underline">describe your situation</Link> and we will list professionals who may be relevant.</Alert>
    </Container>
  );
}
