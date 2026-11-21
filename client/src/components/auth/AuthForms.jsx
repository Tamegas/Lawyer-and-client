import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert } from '../ui/Feedback.jsx';
import { Button } from '../ui/Button.jsx';
import { CheckboxField, RadioGroup, SelectField, TextField } from '../ui/Fields.jsx';
import { Icon } from '../ui/Icon.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useReferenceOptions } from '../../context/ReferenceContext.jsx';
import { useForm } from '../../hooks/useForm.js';
import { errorMessage } from '../../lib/api.js';

export const passwordChecks = (pw) => [
  { ok: pw.length >= 10, text: 'At least 10 characters' },
  { ok: /[A-Za-z]/.test(pw), text: 'At least one letter' },
  { ok: /\d/.test(pw), text: 'At least one number' },
  { ok: pw.length > 0 && pw.length <= 72, text: 'No more than 72 characters' },
];

export function PasswordField({ label = 'Password', value, onChange, error, autoComplete, hint, showChecks = false }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <div className="relative">
        <TextField label={label} type={show ? 'text' : 'password'} value={value} onChange={onChange} error={error} autoComplete={autoComplete} required hint={hint} inputClassName="pr-12" />
        <button type="button" onClick={() => setShow((s) => !s)} aria-pressed={show} aria-label={show ? 'Hide password' : 'Show password'}
          className="absolute right-1 top-[1.85rem] inline-flex h-10 w-10 items-center justify-center rounded-md text-navy-600 hover:bg-navy-50">
          <Icon name={show ? 'eye-off' : 'eye'} className="h-5 w-5" />
        </button>
      </div>
      {showChecks ? (
        <ul className="mt-2 space-y-1 text-xs" aria-label="Password requirements">
          {passwordChecks(value).map((c) => (
            <li key={c.text} className={`flex items-center gap-1.5 ${c.ok ? 'text-emerald-800' : 'text-navy-600'}`}>
              <Icon name={c.ok ? 'check' : 'x'} className="h-3.5 w-3.5" />{c.text}<span className="sr-only">{c.ok ? ' (met)' : ' (not met yet)'}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function LoginForm({ onSuccess, onSwitch }) {
  const { login } = useAuth();
  const form = useForm({ email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setError('');
    setBusy(true);
    try {
      const user = await login(form.values.email.trim(), form.values.password);
      onSuccess?.(user);
    } catch (err) {
      if (!form.applyError(err)) setError(err?.status === 429 ? 'Too many sign-in attempts. Please wait a few minutes and try again.' : errorMessage(err));
    } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <TextField label="Email" type="email" autoComplete="email" required {...form.bind('email')} />
      <PasswordField label="Password" autoComplete="current-password" {...form.bind('password')} />
      <Button type="submit" fullWidth loading={busy}>Sign in</Button>
      <p className="text-xs leading-5 text-navy-600">Password reset by email is not available yet. If you are locked out, contact the platform administrators.</p>
      {onSwitch ? <p className="text-sm">New here? <button type="button" className="font-medium underline underline-offset-4" onClick={onSwitch}>Create an account</button></p>
        : <p className="text-sm">New here? <Link to="/register" className="font-medium underline underline-offset-4">Create an account</Link></p>}
    </form>
  );
}

export function RegisterForm({ onSuccess, onSwitch, initialRole = 'client' }) {
  const { register } = useAuth();
  const { languageOptions } = useReferenceOptions();
  const form = useForm({ role: initialRole, fullName: '', email: '', password: '', preferredLanguage: '', professionalTitle: '', acceptTerms: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const v = form.values;
  const isLawyer = v.role === 'lawyer';

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setError('');
    if (!v.acceptTerms) { form.setErrors({ acceptTerms: 'Please accept the Terms and Privacy Policy to continue' }); return; }
    setBusy(true);
    try {
      const body = { role: v.role, fullName: v.fullName.trim(), email: v.email.trim(), password: v.password, acceptTerms: true };
      if (v.preferredLanguage) body.preferredLanguage = v.preferredLanguage;
      if (isLawyer && v.professionalTitle.trim()) body.professionalTitle = v.professionalTitle.trim();
      onSuccess?.(await register(body));
    } catch (err) {
      if (!form.applyError(err)) setError(err?.status === 429 ? 'Too many attempts. Please wait a few minutes and try again.' : errorMessage(err));
    } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <RadioGroup legend="I am registering as" name="role" value={v.role} onChange={(x) => form.setValue('role', x)}
        options={[{ value: 'client', label: 'I need legal help', hint: 'Find lawyers, ask for fee quotations, book appointments' }, { value: 'lawyer', label: 'I am a lawyer / legal professional', hint: 'Create a profile and receive inquiries' }]} />
      {isLawyer ? <Alert tone="info">Lawyer accounts start as “Not verified” and stay unpublished until you complete your profile. You may submit credentials for an administrator to review. Nothing shows as verified until that review is done.</Alert> : null}
      <TextField label="Full name" autoComplete="name" required {...form.bind('fullName')} />
      <TextField label="Email" type="email" autoComplete="email" required {...form.bind('email')} />
      <PasswordField label="Password" autoComplete="new-password" showChecks {...form.bind('password')} />
      {isLawyer ? <TextField label="Professional title" placeholder="e.g. Advocate, Legal consultant" {...form.bind('professionalTitle')} /> : null}
      <SelectField label="Preferred language" placeholder="Choose a language" options={languageOptions} {...form.bind('preferredLanguage')} />
      <CheckboxField label={<>I accept the <Link to="/terms" target="_blank" className="underline">Terms of Service</Link> and have read the <Link to="/privacy" target="_blank" className="underline">Privacy Policy</Link>.</>}
        checked={v.acceptTerms} error={form.errors.acceptTerms} onChange={(e) => form.setValue('acceptTerms', e.target.checked)} />
      <Button type="submit" variant="gold" fullWidth loading={busy}>Create account</Button>
      {onSwitch ? <p className="text-sm">Already have an account? <button type="button" className="font-medium underline underline-offset-4" onClick={onSwitch}>Sign in</button></p>
        : <p className="text-sm">Already have an account? <Link to="/login" className="font-medium underline underline-offset-4">Sign in</Link></p>}
    </form>
  );
}
