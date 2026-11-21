import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PasswordField } from '../../components/auth/AuthForms.jsx';
import { Alert } from '../../components/ui/Feedback.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { SelectField, TextField } from '../../components/ui/Fields.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Card, PageHeader } from '../../components/ui/Primitives.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useReferenceOptions } from '../../context/ReferenceContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useForm } from '../../hooks/useForm.js';
import { useDocumentTitle } from '../../hooks/usePage.js';
import { api, errorMessage } from '../../lib/api.js';

function Profile() {
  const { user, refresh } = useAuth();
  const toast = useToast();
  const { languageOptions } = useReferenceOptions();
  const form = useForm({ fullName: user.fullName ?? '', preferredLanguage: user.language ?? '', phone: user.phone ?? '' });
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try { await api.patch('/me', { fullName: form.values.fullName.trim(), preferredLanguage: form.values.preferredLanguage || undefined, phone: form.values.phone.trim() || null }); await refresh(); toast.success('Profile updated.'); }
    catch (err) { if (!form.applyError(err)) toast.error(errorMessage(err)); } finally { setBusy(false); }
  };
  return (
    <Card as="section" aria-labelledby="prof-h"><h2 id="prof-h" className="text-lg font-semibold">Your details</h2>
      <p className="mt-1 text-sm text-navy-700">Signed in as <strong>{user.email}</strong> <Badge className="ml-1 capitalize">{user.role}</Badge></p>
      <form onSubmit={submit} className="mt-4 space-y-4" noValidate>
        <TextField label="Full name" required autoComplete="name" {...form.bind('fullName')} />
        <SelectField label="Preferred language" placeholder="No preference" options={languageOptions} {...form.bind('preferredLanguage')} />
        <TextField label="Phone (optional)" type="tel" autoComplete="tel" hint="Private. Never shown on a public profile, and not shared with lawyers." {...form.bind('phone')} />
        <Button type="submit" loading={busy} disabled={!form.dirty}>Save changes</Button>
      </form>
      {user.role === 'lawyer' ? <p className="mt-4 text-sm">Your public profile is edited in <Link to="/lawyer/profile" className="font-medium underline">My profile</Link>.</p> : null}
    </Card>
  );
}

function Password() {
  const toast = useToast();
  const form = useForm({ currentPassword: '', newPassword: '' });
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try { await api.post('/me/password', form.values); form.reset({ currentPassword: '', newPassword: '' }); toast.success('Password changed. Your other sessions were signed out.'); }
    catch (err) { if (!form.applyError(err)) toast.error(errorMessage(err)); } finally { setBusy(false); }
  };
  return (
    <Card as="section" aria-labelledby="pw-h"><h2 id="pw-h" className="text-lg font-semibold">Change password</h2>
      <form onSubmit={submit} className="mt-4 space-y-4" noValidate>
        <PasswordField label="Current password" autoComplete="current-password" {...form.bind('currentPassword')} />
        <PasswordField label="New password" autoComplete="new-password" showChecks {...form.bind('newPassword')} />
        <Button type="submit" loading={busy}>Change password</Button>
      </form></Card>
  );
}

function Privacy() {
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const download = async () => {
    try {
      const data = await api.get('/me/export');
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = 'my-data.json'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    } catch (e) { toast.error(errorMessage(e)); }
  };
  const close = async () => {
    if (busy) return;
    setBusy(true); setErr('');
    try { await api.post('/me/delete', { password }); toast.success('Your account was closed.'); await refresh(); navigate('/', { replace: true }); }
    catch (e) { setErr(errorMessage(e)); } finally { setBusy(false); }
  };
  return (
    <Card as="section" aria-labelledby="priv-h"><h2 id="priv-h" className="text-lg font-semibold">Privacy and your data</h2>
      <p className="mt-2 text-sm leading-6 text-navy-700">You can download a copy of the data stored about you, or close your account. See the <Link to="/privacy" className="underline">Privacy Policy draft</Link> for what is collected.</p>
      <div className="mt-4 flex flex-wrap gap-3"><Button variant="secondary" icon="download" onClick={download}>Download my data</Button><Button variant="danger" onClick={() => setOpen(true)}>Close my account</Button></div>
      <Modal open={open} onClose={() => setOpen(false)} title="Close your account?" description="Your name and email are removed, you are signed out everywhere and you can no longer sign in. Messages you sent may remain visible to the other person under a generic name for a limited retention period."
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Keep my account</Button><Button variant="danger" loading={busy} onClick={close} disabled={!password}>Close account</Button></>}>
        {err ? <Alert tone="danger" className="mb-3">{err}</Alert> : null}
        <PasswordField label="Enter your password to confirm" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </Modal></Card>
  );
}

export default function Account() {
  useDocumentTitle('Account and privacy');
  return (
    <>
      <PageHeader title="Account and privacy" description="Manage your details, password and data." />
      <div className="space-y-6"><Profile /><Password /><Privacy /></div>
    </>
  );
}
