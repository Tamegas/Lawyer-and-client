import { useNavigate, useSearchParams } from 'react-router-dom';
import { RegisterForm } from '../../components/auth/AuthForms.jsx';
import { Card, Container, PageHeader } from '../../components/ui/Primitives.jsx';
import { useDocumentTitle } from '../../hooks/usePage.js';
import { roleHome } from '../../lib/labels.js';

export default function Register() {
  useDocumentTitle('Create an account');
  const navigate = useNavigate();
  const [params] = useSearchParams();
  return (
    <Container narrow className="max-w-lg py-12">
      <PageHeader title="Create your account" description="Free for people looking for legal help. Lawyers can create a profile and submit credentials for verification." />
      <Card><RegisterForm initialRole={params.get('role') === 'lawyer' ? 'lawyer' : 'client'} onSuccess={(u) => navigate(roleHome[u.role] || '/', { replace: true })} /></Card>
    </Container>
  );
}
