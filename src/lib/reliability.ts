import type { Invoice } from './types';
import { daysBetween } from './dates';
import { outstanding } from './money';

export type ReliabilityLabel = 'Reliable' | 'Usually on time' | 'Often late' | 'New';

export interface ReliabilityResult {
  /** 0-1 */
  score: number;
  /** mean days from issue to last payment, null if not enough data */
  avgDaysToPay: number | null;
  /** share of paid invoices paid on or before due date, null if not enough data */
  onTimePct: number | null;
  label: ReliabilityLabel;
}

const MIN_PAID = 2;

/** `_now` is accepted for a uniform signature; scoring uses only paid invoices. */
export function reliabilityScore(invoices: Invoice[], _now: string): ReliabilityResult {
  const paid = invoices.filter((inv) => inv.sent && inv.payments.length > 0 && outstanding(inv) === 0);

  if (paid.length < MIN_PAID) {
    return { score: 0.5, avgDaysToPay: null, onTimePct: null, label: 'New' };
  }

  let sumLateness = 0;
  let sumDaysToPay = 0;
  let onTimeCount = 0;

  for (const inv of paid) {
    const lastPaidOn = inv.payments.reduce(
      (latest, p) => (p.paidOn > latest ? p.paidOn : latest),
      inv.payments[0].paidOn,
    );
    const lateness = daysBetween(inv.dueOn, lastPaidOn);
    sumLateness += lateness;
    sumDaysToPay += daysBetween(inv.issuedOn, lastPaidOn);
    if (lateness <= 0) onTimeCount += 1;
  }

  const n = paid.length;
  const onTimePct = onTimeCount / n;
  const avgLateness = sumLateness / n;
  const avgDaysToPay = sumDaysToPay / n;

  const score = 0.6 * onTimePct + 0.4 * (1 - Math.min(1, Math.max(0, avgLateness) / 30));

  let label: ReliabilityLabel;
  if (score >= 0.8) label = 'Reliable';
  else if (score >= 0.5) label = 'Usually on time';
  else label = 'Often late';

  return { score, avgDaysToPay, onTimePct, label };
}
