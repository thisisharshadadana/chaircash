import type { Customer, Invoice } from './types';
import { daysOverdue } from './aging';
import { formatINR, outstanding } from './money';
import { reliabilityScore } from './reliability';
import type { ReliabilityLabel } from './reliability';
import { draftReminder, whatsappLink } from './reminders';
import type { Tone } from './reminders';

const BUSINESS_NAME = "Anjali's Studio";

export interface CollectionStep {
  rank: number;
  invoiceId: string;
  customerId: string;
  customerName: string;
  phone: string;
  amount: number;
  daysOverdue: number;
  tone: Tone;
  message: string;
  whatsappUrl: string;
  /** running total of amounts collected if steps 1..rank are paid */
  cashUnlocked: number;
  reliability: ReliabilityLabel;
}

export interface AutopilotPlan {
  steps: CollectionStep[];
  totalOverdue: number;
  /** sum of the planned steps' amounts */
  totalRecoverable: number;
  cashGapToFloor: number;
  coversGap: boolean;
  summary: string;
}

interface Candidate {
  invoice: Invoice;
  customer: Customer;
  amount: number;
  days: number;
  reliability: ReliabilityLabel;
  score: number;
}

function toneFor(days: number): Tone {
  if (days <= 7) return 'friendly';
  if (days <= 30) return 'firm';
  return 'final';
}

export function buildAutopilot(params: {
  now: string;
  invoices: Invoice[];
  customers: Customer[];
  lowestBalance: number;
  safetyFloor: number;
  maxSteps?: number;
}): AutopilotPlan {
  const { now, invoices, customers, lowestBalance, safetyFloor, maxSteps = 5 } = params;

  const customerById = new Map(customers.map((c) => [c.id, c]));
  const labelCache = new Map<string, ReliabilityLabel>();
  const labelFor = (customerId: string): ReliabilityLabel => {
    const cached = labelCache.get(customerId);
    if (cached !== undefined) return cached;
    const label = reliabilityScore(
      invoices.filter((i) => i.customerId === customerId),
      now,
    ).label;
    labelCache.set(customerId, label);
    return label;
  };

  const candidates: Candidate[] = [];
  for (const invoice of invoices) {
    if (!invoice.sent) continue;
    const amount = Math.round(outstanding(invoice));
    if (amount <= 0) continue;
    const days = daysOverdue(invoice, now);
    if (days <= 0) continue;
    const customer = customerById.get(invoice.customerId);
    if (!customer) continue;

    const reliability = labelFor(invoice.customerId);
    // Late-prone customers (anything other than Reliable / Usually on time) get a
    // 1.3x priority bump so they are chased while the money is still recoverable.
    const lateProne = reliability !== 'Reliable' && reliability !== 'Usually on time';
    const score = amount * (1 + Math.min(days, 60) / 60) * (lateProne ? 1.3 : 1.0);

    candidates.push({ invoice, customer, amount, days, reliability, score });
  }

  const totalOverdue = candidates.reduce((sum, c) => sum + c.amount, 0);

  candidates.sort((a, b) => b.score - a.score || a.invoice.id.localeCompare(b.invoice.id));
  const picked = candidates.slice(0, maxSteps);

  let running = 0;
  const steps: CollectionStep[] = picked.map((c, index) => {
    running += c.amount;
    const tone = toneFor(c.days);
    const message = draftReminder({
      customerName: c.customer.name,
      amount: c.amount,
      dueOn: c.invoice.dueOn,
      tone,
      businessName: BUSINESS_NAME,
      daysOverdue: c.days,
    });
    return {
      rank: index + 1,
      invoiceId: c.invoice.id,
      customerId: c.customer.id,
      customerName: c.customer.name,
      phone: c.customer.phone,
      amount: c.amount,
      daysOverdue: c.days,
      tone,
      message,
      whatsappUrl: whatsappLink(c.customer.phone, message),
      cashUnlocked: running,
      reliability: c.reliability,
    };
  });

  const totalRecoverable = steps.reduce((sum, s) => sum + s.amount, 0);
  const cashGapToFloor = Math.max(0, Math.round(safetyFloor - lowestBalance));
  const coversGap = cashGapToFloor > 0 && totalRecoverable >= cashGapToFloor;

  let summary: string;
  if (cashGapToFloor === 0) {
    summary = `No cash gap: collect these ${steps.length} to protect your margin.`;
  } else if (steps.length === 0) {
    summary = `No overdue invoices to chase; the ${formatINR(cashGapToFloor)} gap needs new payments or a payment plan.`;
  } else if (coversGap) {
    summary =
      `If these ${steps.length} pay this week you recover ${formatINR(totalRecoverable)}, ` +
      `enough to clear the ${formatINR(cashGapToFloor)} gap.`;
  } else {
    summary =
      `If these ${steps.length} pay this week you recover ${formatINR(totalRecoverable)}, ` +
      `still ${formatINR(cashGapToFloor - totalRecoverable)} short of the ${formatINR(cashGapToFloor)} gap.`;
  }

  return {
    steps,
    totalOverdue,
    totalRecoverable,
    cashGapToFloor,
    coversGap,
    summary,
  };
}
