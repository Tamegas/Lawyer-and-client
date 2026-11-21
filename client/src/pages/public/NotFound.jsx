import { Button } from '../../components/ui/Button.jsx';
import { Container } from '../../components/ui/Primitives.jsx';
import { useDocumentTitle } from '../../hooks/usePage.js';

export default function NotFound() {
  useDocumentTitle('Page not found');
  return (
    <Container narrow className="py-24 text-center">
      <p className="font-serif text-6xl font-semibold text-gold-600">404</p>
      <h1 className="mt-3 text-3xl font-semibold">We can’t find that page</h1>
      <p className="mx-auto mt-3 max-w-md text-navy-700">The address may be mistyped, or the page may have moved or been removed.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button to="/" variant="primary">Go to Home</Button>
        <Button to="/lawyers" variant="secondary">Find a Lawyer</Button>
        <Button to="/help" variant="ghost">Help Center</Button>
      </div>
    </Container>
  );
}
