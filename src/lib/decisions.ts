import type { Bill, Customer, Invoice } from './types';
import { format, parseISO } from 'date-fns';
import { addDaysISO } from './dates';
import {
  buildForecast,
  expectedReceiptDate,
  type ForecastParams,
  type ForecastResult,
} from './forecast';
import { formatINR, outstanding } from './money';

export type OptionId = 'early-pay-discount' | 'defer-supplier-bill' | 'short-loan';

export interface DecisionOption {
  id: OptionId;
  label: string;
  cost: number;
  cashGain: number;
  netEffect: number;
  minBalanceAfter: number;
  clearsFloor: boolean;
  explanation: string;
}

export interface DecisionParams {
  now: string;
  horizonDays: 30 | 60 | 90;
  openingCash: number;
  safetyFloor: number;
  customers: Customer[];
  invoices: Invoice[];
  bills: Bill[];
  onTimeProbability: Record<string, number>;
  topOwingCustomerId: string | null;
}

const EARLY_PAY_DISCOUNT_RATE = 0.03;
const LOAN_RATE_PER_30_DAYS = 0.015;
const LOAN_MIN_PRINCIPAL = 1000;
const DEFER_DAYS = 10;
const DEFER_HORIZON_DAYS = 90;

type Overrides = Partial<
  Pick<DecisionParams, 'customers' | 'invoices' | 'bills' | 'onTimeProbability'>
>;

function runForecast(
  p: DecisionParams,
  over: Overrides = {},
  expectedOverride?: Record<string, string>,
): ForecastResult {
  const forecastParams: ForecastParams = {
    now: p.now,
    horizonDays: p.horizonDays,
    openingCash: p.openingCash,
    safetyFloor: p.safetyFloor,
    customers: over.customers ?? p.customers,
    invoices: over.invoices ?? p.invoices,
    bills: over.bills ?? p.bills,
    onTimeProbability: over.onTimeProbability ?? p.onTimeProbability,
    expectedOverride,
  };
  return buildForecast(forecastParams);
}

function makeOption(
  base: Omit<DecisionOption, 'netEffect' | 'clearsFloor'>,
  safetyFloor: number,
): DecisionOption {
  return {
    ...base,
    netEffect: base.cashGain - base.cost,
    clearsFloor: base.minBalanceAfter >= safetyFloor,
  };
}

function earlyPayOption(p: DecisionParams, baseline: ForecastResult): DecisionOption {
  const label = 'Offer early-payment discount';
  const id = p.topOwingCustomerId;
  const baseMin = baseline.minBalance;
  if (id === null) {
    return makeOption(
      { id: 'early-pay-discount', label, cost: 0, cashGain: 0, minBalanceAfter: baseMin,
        explanation: 'No customer selected; no discount offered.' },
      p.safetyFloor,
    );
  }
  const open = p.invoices.filter((i) => i.customerId === id && i.sent && outstanding(i) > 0);
  const alreadyExpected =
    open.length > 0 &&
    open.every(
      (inv) =>
        expectedReceiptDate(inv, p.customers, p.invoices, p.now, 0) <= baseline.minBalanceDate,
    );
  if (alreadyExpected) {
    const name = p.customers.find((c) => c.id === id)?.name ?? id;
    return makeOption(
      { id: 'early-pay-discount', label, cost: 0, cashGain: 0, minBalanceAfter: baseMin,
        explanation: `Won't help: ${name} is already expected before your low point.` },
      p.safetyFloor,
    );
  }
  const owed = p.invoices
    .filter((i) => i.customerId === id && i.sent)
    .reduce((sum, i) => sum + outstanding(i), 0);
  const cost = Math.round(EARLY_PAY_DISCOUNT_RATE * owed);
  const expectedOverride: Record<string, string> = {};
  for (const inv of p.invoices) {
    if (inv.customerId === id && inv.sent && outstanding(inv) > 0) {
      expectedOverride[inv.id] = addDaysISO(p.now, 1);
    }
  }
  const minBalanceAfter = runForecast(p, {}, expectedOverride).minBalance;
  const cashGain = Math.max(0, Math.round(minBalanceAfter - baseMin));
  return makeOption(
    { id: 'early-pay-discount', label, cost, cashGain, minBalanceAfter,
      explanation: `A ${formatINR(cost)} (3%) discount to the top debtor to pay within 1 day changes the low point by ${formatINR(cashGain)}.` },
    p.safetyFloor,
  );
}

/** ISO date of `dueDay` in the given month, clamped to the month's last day. */
function occurrenceInMonth(year: number, month0: number, dueDay: number): string {
  const lastDay = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
  const day = Math.min(dueDay, lastDay);
  return `${year}-${String(month0 + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Every occurrence of a monthly `dueDay` on or after `now` and on or before `untilISO`, in order. */
function monthlyOccurrencesFrom(now: string, dueDay: number, untilISO: string): string[] {
  const y0 = Number(now.slice(0, 4));
  const m0 = Number(now.slice(5, 7)) - 1;
  const out: string[] = [];
  for (let k = 0; k < 6; k++) {
    const total = m0 + k;
    const occ = occurrenceInMonth(y0 + Math.floor(total / 12), total % 12, dueDay);
    if (occ < now) continue;
    if (occ > untilISO) break;
    out.push(occ);
  }
  return out;
}

function deferBillOption(p: DecisionParams, baseMin: number): DecisionOption {
  const label = 'Defer largest supplier bill';
  const candidates = p.bills
    .filter((b) => (b.category === 'supplier' || b.category === 'other') && b.recurring === 'monthly')
    .sort((a, b) => b.amount - a.amount);
  const target = candidates[0];
  if (!target) {
    return makeOption(
      { id: 'defer-supplier-bill', label, cost: 0, cashGain: 0, minBalanceAfter: baseMin,
        explanation: 'No supplier bill to defer.' },
      p.safetyFloor,
    );
  }
  // Shift only the next occurrence by DEFER_DAYS; later occurrences keep their dates.
  const occurrences = monthlyOccurrencesFrom(p.now, target.dueDay, addDaysISO(p.now, DEFER_HORIZON_DAYS));
  const [next, ...later] = occurrences;
  if (next === undefined) {
    return makeOption(
      { id: 'defer-supplier-bill', label, cost: 0, cashGain: 0, minBalanceAfter: baseMin,
        explanation: 'No supplier bill to defer.' },
      p.safetyFloor,
    );
  }
  const shifted: Bill = {
    id: `${target.id}-next`,
    name: target.name,
    amount: target.amount,
    category: target.category,
    dueDay: target.dueDay,
    recurring: 'once',
    onceOn: addDaysISO(next, DEFER_DAYS),
  };
  const kept: Bill[] = later.map((occ, i): Bill => ({
    id: `${target.id}-m${i}`,
    name: target.name,
    amount: target.amount,
    category: target.category,
    dueDay: target.dueDay,
    recurring: 'once',
    onceOn: occ,
  }));
  const bills = [...p.bills.filter((b) => b !== target), shifted, ...kept];
  const deferredMin = runForecast(p, { bills }).minBalance;
  // A deferral must never lower the low point.
  const minBalanceAfter = Math.max(deferredMin, baseMin);
  const cashGain = Math.max(0, Math.round(minBalanceAfter - baseMin));
  return makeOption(
    { id: 'defer-supplier-bill', label, cost: 0, cashGain, minBalanceAfter,
      explanation: `Asking the supplier for a ${DEFER_DAYS}-day deferral on ${target.name} (assumed free) changes the low point by ${formatINR(cashGain)}.` },
    p.safetyFloor,
  );
}

function shortLoanOption(p: DecisionParams, baseMin: number): DecisionOption {
  const label = 'Take a short loan';
  const shortfall = Math.max(0, p.safetyFloor - baseMin);
  const principal = Math.max(LOAN_MIN_PRINCIPAL, Math.ceil(shortfall / 1000) * 1000);
  const interest = Math.round(principal * LOAN_RATE_PER_30_DAYS * (p.horizonDays / 30));
  const loanCustomer: Customer = { id: 'loan', name: 'Loan', phone: '' };
  const loanIn: Invoice = {
    id: 'loan-in', customerId: 'loan', description: 'Loan principal', amount: principal,
    issuedOn: p.now, dueOn: p.now, sent: true, payments: [], reminders: [],
  };
  const repayOn = addDaysISO(p.now, p.horizonDays);
  const loanOut: Bill = {
    id: 'loan-tmp', name: 'Loan repayment', amount: principal + interest, category: 'other',
    dueDay: 1, recurring: 'once', onceOn: repayOn,
  };
  const minBalanceAfter = runForecast(p, {
    customers: [...p.customers, loanCustomer],
    invoices: [...p.invoices, loanIn],
    bills: [...p.bills, loanOut],
    onTimeProbability: { ...p.onTimeProbability, loan: 1 },
  }).minBalance;
  return makeOption(
    { id: 'short-loan', label, cost: interest, cashGain: principal, minBalanceAfter,
      explanation: `Borrow ${formatINR(principal)} now; repay ${formatINR(principal + interest)} on ${format(parseISO(repayOn), 'd MMM')} (includes ${formatINR(interest)} interest).` },
    p.safetyFloor,
  );
}

export function buildDecisionOptions(params: DecisionParams): DecisionOption[] {
  const baseline = runForecast(params);
  const baseMin = baseline.minBalance;
  const options = [
    earlyPayOption(params, baseline),
    deferBillOption(params, baseMin),
    shortLoanOption(params, baseMin),
  ];
  return options.sort(
    (a, b) => Number(b.clearsFloor) - Number(a.clearsFloor) || b.netEffect - a.netEffect,
  );
}
