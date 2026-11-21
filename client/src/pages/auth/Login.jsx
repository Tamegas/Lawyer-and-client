import { useLocation, useNavigate } from 'react-router-dom';
import { LoginForm } from '../../components/auth/AuthForms.jsx';
import { Card, Container, PageHeader } from '../../components/ui/Primitives.jsx';
import { useDocumentTitle } from '../../hooks/usePage.js';
import { roleHome } from '../../lib/labels.js';

export default function Login() {
  useDocumentTitle('Sign in');
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <Container narrow className="max-w-md py-12">
      <PageHeader title="Sign in" description="Welcome back. Sign in to manage your requests, messages and appointments." />
      <Card><LoginForm onSuccess={(u) => navigate(location.state?.from || roleHome[u.role] || '/', { replace: true })} /></Card>
    </Container>
  );
}
