import { useState } from 'react';
import { LawyerCard } from '../../components/lawyers/LawyerCard.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { EmptyState, Loadable } from '../../components/ui/Feedback.jsx';
import { PageHeader } from '../../components/ui/Primitives.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useDocumentTitle } from '../../hooks/usePage.js';
import { api, errorMessage } from '../../lib/api.js';

export default function ClientSaved() {
  useDocumentTitle('Saved lawyers');
  const toast = useToast();
  const { data, loading, error, reload, setData } = useApi('/me/saved');
  const [busy, setBusy] = useState('');
  const list = data?.lawyers ?? [];
  const remove = async (l) => {
    setBusy(l.id);
    try { await api.delete(`/me/saved/${l.id}`); setData((d) => ({ ...d, lawyers: d.lawyers.filter((x) => x.id !== l.id) })); toast.success('Removed from saved lawyers.'); }
    catch (err) { toast.error(errorMessage(err)); } finally { setBusy(''); }
  };
  return (
    <>
      <PageHeader title="Saved lawyers" description="Lawyers you have bookmarked to compare later." />
      <Loadable loading={loading} error={error} onRetry={reload} isEmpty={!list.length}
        empty={<EmptyState icon="heart" title="No saved lawyers yet" description="Use “Save lawyer” on a profile to keep it here." action={<Button to="/lawyers">Find a lawyer</Button>} />}>
        <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{list.map((l) => (
          <li key={l.id}><LawyerCard lawyer={l} footer={<Button size="sm" variant="ghost" fullWidth loading={busy === l.id} onClick={() => remove(l)} icon="trash">Remove from saved</Button>} /></li>))}</ul>
      </Loadable>
    </>
  );
}
