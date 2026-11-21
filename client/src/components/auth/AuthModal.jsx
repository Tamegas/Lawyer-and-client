import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { Alert } from '../ui/Feedback.jsx';
import { Modal } from '../ui/Modal.jsx';
import { LoginForm, RegisterForm } from './AuthForms.jsx';

/** Rendered once in App.jsx. Opens when a page calls promptAuth(); resolves that promise with the user (or null if closed). */
export function AuthModal() {
  const { prompt, closePrompt } = useAuth();
  const [mode, setMode] = useState('login');
  useEffect(() => { if (prompt) setMode(prompt.mode ?? 'login'); }, [prompt]);
  if (!prompt) return null;
  return (
    <Modal open onClose={() => closePrompt(null)} size="md" title={mode === 'login' ? 'Sign in' : 'Create your account'}>
      {prompt.message ? <Alert tone="info" className="mb-4">{prompt.message}</Alert> : null}
      {mode === 'login'
        ? <LoginForm onSuccess={(u) => closePrompt(u)} onSwitch={() => setMode('register')} />
        : <RegisterForm initialRole={prompt.role === 'lawyer' ? 'lawyer' : 'client'} onSuccess={(u) => closePrompt(u)} onSwitch={() => setMode('login')} />}
    </Modal>
  );
}
