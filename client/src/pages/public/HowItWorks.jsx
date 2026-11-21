import { Link } from 'react-router-dom';
import { Alert } from '../../components/ui/Feedback.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Icon } from '../../components/ui/Icon.jsx';
import { Card, Container, PageHeader } from '../../components/ui/Primitives.jsx';
import { useDocumentTitle } from '../../hooks/usePage.js';

const STEPS = [
  ['Describe your legal issue', 'Use the guided form to explain your situation in general terms: the type of problem, where it is, when it began, any deadline, and the language and consultation method you prefer. Nothing is sent to any lawyer at this point.'],
  ['Compare suitable legal professionals', 'You get a list of professionals who list your type of issue as a specialisation, with their experience, languages, location, consultation fee and verification status. You can also browse the directory and use filters.'],
  ['Contact a lawyer and discuss your case', 'Send a message from a lawyer’s profile. If you want them to read your request, you explicitly consent to share it with that lawyer, and you can withdraw that access later.'],
  ['Discuss fees openly', 'Ask for an itemised quotation, compare proposals, ask polite questions about what is included, and request an appointment. Nobody is pressured to accept a price.'],
  ['Decide and engage', 'If you decide to go ahead, you and the lawyer agree the engagement directly. Contracts and payments happen outside this platform.'],
];

const FEES = [
  ['Consultation fee', 'The charge for an initial conversation about your issue. Some lawyers list it; others say “Contact for pricing”.'],
  ['Hourly rate', 'Charged for the time spent on your matter. Ask for an estimate of the hours.'],
  ['Fixed fee', 'One agreed amount for a defined scope of work. Ask what is and is not included.'],
  ['Additional expenses', 'Costs that may sit outside the lawyer’s fee, such as court fees, travel, translation or document costs. Ask which apply.'],
];

export default function HowItWorks() {
  useDocumentTitle('How it works');
  return (
    <Container narrow className="py-10">
      <PageHeader eyebrow="How it works" title="From a legal problem to a conversation with a lawyer" />
      <ol className="space-y-4">
        {STEPS.map(([title, text], i) => (
          <li key={title} className="flex gap-4 rounded-2xl bg-white p-5 shadow-card ring-1 ring-navy-100">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy-900 font-serif text-lg font-semibold text-gold-300">{i + 1}</span>
            <div><h2 className="text-lg font-semibold">{title}</h2><p className="mt-1 text-sm leading-6 text-navy-700">{text}</p></div>
          </li>
        ))}
      </ol>

      <h2 className="mt-12 text-2xl font-semibold">How legal fees work, in one line each</h2>
      <dl className="mt-4 divide-y divide-navy-100 rounded-2xl bg-white p-2 shadow-card ring-1 ring-navy-100">
        {FEES.map(([t, d]) => <div key={t} className="grid gap-1 p-4 sm:grid-cols-3"><dt className="font-medium text-navy-950">{t}</dt><dd className="text-sm text-navy-700 sm:col-span-2">{d}</dd></div>)}
      </dl>
      <p className="mt-3 text-sm">Use the <Link to="/fee-assistant" className="font-medium underline underline-offset-4">Fee Discussion Assistant</Link> to prepare questions and compare quotations.</p>

      <div className="mt-12 grid gap-5 sm:grid-cols-2">
        <Card><h2 className="flex items-center gap-2 text-lg font-semibold"><Icon name="check" className="h-5 w-5 text-emerald-700" />What the platform does</h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-navy-800"><li>Helps you organise your issue and find professionals</li><li>Shows profiles, fees and verification status</li><li>Carries messages, quotation requests and appointment requests</li><li>Lets you report suspicious profiles, reviews and messages</li></ul></Card>
        <Card><h2 className="flex items-center gap-2 text-lg font-semibold"><Icon name="x" className="h-5 w-5 text-red-700" />What it does not do</h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-navy-800"><li>Give legal advice or replace a lawyer</li><li>Promise or predict any outcome</li><li>Guarantee a lawyer’s quality beyond the stated verification</li><li>Handle contracts or payments between you and a lawyer</li></ul></Card>
      </div>

      <section className="mt-12" aria-labelledby="notyet">
        <Alert tone="warning" title="Not available yet">
          <ul id="notyet" className="mt-1 list-disc space-y-1 pl-5">
            <li><Icon name="message" className="mr-1 inline h-4 w-4" />Real-time chat: messages are delivered in the app, without live presence.</li>
            <li><Icon name="video-off" className="mr-1 inline h-4 w-4" />Video calls: online appointments use the lawyer’s own meeting link.</li>
            <li><Icon name="bell-off" className="mr-1 inline h-4 w-4" />Email and SMS notifications: check Messages and Appointments in the app.</li>
            <li><Icon name="credit-card-off" className="mr-1 inline h-4 w-4" />Online payments: you agree and pay fees directly with the lawyer.</li>
          </ul>
        </Alert>
      </section>
      <div className="mt-10 flex flex-wrap gap-3"><Button to="/describe-problem" variant="gold">Describe My Legal Problem</Button><Button to="/lawyers" variant="secondary">Find a Lawyer</Button></div>
    </Container>
  );
}
