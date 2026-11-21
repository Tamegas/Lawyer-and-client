import { Alert } from '../../components/ui/Feedback.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Icon } from '../../components/ui/Icon.jsx';
import { Container, PageHeader } from '../../components/ui/Primitives.jsx';
import { useDocumentTitle } from '../../hooks/usePage.js';
import { BRAND } from '../../lib/brand.js';

const PRINCIPLES = [
  ['eye', 'Transparency', 'Fees, experience, languages and verification status are shown plainly. “Verified” appears only when an administrator has reviewed credentials.'],
  ['lock', 'Privacy first', 'Your legal problem is never public. You choose whether to share it with a lawyer, and you can withdraw that access.'],
  ['scale', 'No outcome promises', 'Nothing here predicts or guarantees a result. Case summaries are lawyer-submitted and labelled by how well they are documented.'],
  ['users', 'Clear for everyone', 'Plain language, accessible forms and a layout that works on a phone, because many people look for legal help on one.'],
];

export default function About() {
  useDocumentTitle('About us');
  return (
    <Container narrow className="py-10">
      <PageHeader eyebrow="About us" title={`About ${BRAND.name}`} description="An early-stage platform that helps people with legal problems find and talk to legal professionals, starting in Ethiopia and built so other countries can follow." />
      <div className="prose-legal">
        <p>{BRAND.name} is a directory and introduction service. People describe their situation in general terms, compare lawyers who work on that kind of issue, understand how legal fees work, and contact a lawyer to take the next step.</p>
        <p>It is not a law firm, it does not give legal advice, and the lawyers listed are independent professionals who are responsible for their own conduct and for following the rules that apply to them.</p>
        <p>The product is in an early stage. We would rather say plainly what works and what does not yet exist than overstate it. Chat, video calls, notifications and online payments are not available yet.</p>
      </div>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2">
        {PRINCIPLES.map(([icon, t, d]) => (
          <li key={t} className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-navy-100"><Icon name={icon} className="mb-2 h-6 w-6 text-gold-700" /><h2 className="text-lg font-semibold">{t}</h2><p className="mt-1 text-sm leading-6 text-navy-700">{d}</p></li>
        ))}
      </ul>
      <Alert className="mt-8" tone="warning" title="Demonstration data">Profiles labelled “Demo profile · fictional” are invented to show how the platform works. They are not real lawyers, and no case summary, credential or fee on them is real.</Alert>
      <div className="mt-8"><Button to="/contact" variant="secondary">Contact us</Button></div>
    </Container>
  );
}
