import { DescriptionList } from '../ui/Primitives.jsx';
import { formatDate, formatMoney } from '../../lib/format.js';
import { FEE_TYPE_LABELS } from '../../lib/labels.js';

/** Read-only view of a lawyer's fee proposal (the `proposal` object from GET /api/quotations/:id). */
export function ProposalView({ proposal }) {
  const cur = proposal.currency;
  return (
    <div>
      <DescriptionList items={[
        { label: 'Fee type', value: FEE_TYPE_LABELS[proposal.feeType] ?? proposal.feeType },
        { label: 'Fixed amount', value: proposal.fixedAmount != null ? formatMoney(proposal.fixedAmount, cur) : null },
        { label: 'Hourly rate', value: proposal.hourlyRate != null ? `${formatMoney(proposal.hourlyRate, cur)} per hour` : null },
        { label: 'Estimated hours', value: proposal.estimatedHours },
        { label: 'Total estimate', value: proposal.totalEstimate != null ? <strong>{formatMoney(proposal.totalEstimate, cur)}</strong> : 'No total estimate given' },
        { label: 'Scope of work', value: <span className="whitespace-pre-line">{proposal.scopeOfWork}</span> },
        { label: 'Payment schedule', value: proposal.paymentSchedule && <span className="whitespace-pre-line">{proposal.paymentSchedule}</span> },
        { label: 'Exclusions', value: proposal.exclusions && <span className="whitespace-pre-line">{proposal.exclusions}</span> },
        { label: 'Expenses', value: proposal.expensesNote && <span className="whitespace-pre-line">{proposal.expensesNote}</span> },
        { label: 'Valid until', value: proposal.validUntil && formatDate(proposal.validUntil) },
      ]} />
      {proposal.items?.length ? (
        <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><caption className="mb-1 text-left text-sm font-medium">Itemised fees</caption>
          <thead><tr className="border-b border-navy-200 text-navy-600"><th scope="col" className="py-1.5">Item</th><th scope="col" className="text-right">Amount</th></tr></thead>
          <tbody>{proposal.items.map((i) => <tr key={i.id} className="border-b border-navy-100"><td className="py-1.5 pr-3">{i.description}</td><td className="text-right">{formatMoney(i.amount, cur)}</td></tr>)}</tbody></table></div>
      ) : null}
    </div>
  );
}
