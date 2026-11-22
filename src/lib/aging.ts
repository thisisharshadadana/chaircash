import type { Customer, Invoice } from './types';
import { daysBetween } from './dates';
import { outstanding } from './money';

export type Bucket = '0-7' | '8-30' | '31-60' | '60+';

export interface CustomerDebt {
  customerId: string;
  name: string;
  outstanding: number;
  oldestDueOn: string | null;
  maxDaysOverdue: number;
  buckets: Record<Bucket, number>;
}

export function daysOverdue(inv: Invoice, now: string): number {
  return Math.max(0, daysBetween(inv.dueOn, now));
}

export function bucketFor(days: number): Bucket | null {
  if (days <= 0) return null;
  if (days <= 7) return '0-7';
  if (days <= 30) return '8-30';
  if (days <= 60) return '31-60';
  return '60+';
}

/** Only sent, unpaid invoices count toward debt. */
export function customerDebt(
  customer: Customer,
  invoices: Invoice[],
  now: string,
): CustomerDebt {
  const buckets: Record<Bucket, number> = { '0-7': 0, '8-30': 0, '31-60': 0, '60+': 0 };
  let total = 0;
  let oldestDueOn: string | null = null;
  let maxDaysOverdue = 0;

  for (const inv of invoices) {
    if (inv.customerId !== customer.id || !inv.sent) continue;
    const due = outstanding(inv);
    if (due <= 0) continue;

    total += due;
    if (oldestDueOn === null || inv.dueOn < oldestDueOn) oldestDueOn = inv.dueOn;

    const days = daysOverdue(inv, now);
    maxDaysOverdue = Math.max(maxDaysOverdue, days);
    const bucket = bucketFor(days);
    if (bucket !== null) buckets[bucket] += due;
  }

  return {
    customerId: customer.id,
    name: customer.name,
    outstanding: total,
    oldestDueOn,
    maxDaysOverdue,
    buckets,
  };
}
