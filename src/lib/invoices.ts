import type { Invoice } from './types';
import { outstanding } from './money';

export type InvoiceStatus = 'draft' | 'sent' | 'part-paid' | 'paid' | 'overdue';

/** `now` is an ISO yyyy-mm-dd date for today. */
export function invoiceStatus(inv: Invoice, now: string): InvoiceStatus {
  if (!inv.sent) return 'draft';
  const due = outstanding(inv);
  if (due === 0) return 'paid';
  if (inv.dueOn < now) return 'overdue';
  if (inv.payments.some((p) => p.amount > 0)) return 'part-paid';
  return 'sent';
}
