import type { Invoice } from './types';

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export function formatINR(n: number): string {
  return inrFormatter.format(n);
}

export function outstanding(inv: Invoice): number {
  const paid = inv.payments.reduce((sum, p) => sum + p.amount, 0);
  return Math.max(0, inv.amount - paid);
}
