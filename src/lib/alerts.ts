import { format, parseISO } from 'date-fns';
import type { Bill, Customer, Invoice } from './types';
import type { ForecastResult } from './forecast';
import { addDaysISO } from './dates';
import { daysOverdue } from './aging';
import { formatINR, outstanding } from './money';
import { invoiceStatus } from './invoices';
import { buildAutopilot } from './autopilot';

export type AlertKind = 'chase' | 'cash-dip' | 'bill-due' | 'uncaught-invoice';

export interface Alert {
  id: string;
  kind: AlertKind;
  title: string;
  reason: string;
  actionLabel: string;
  /** higher first */
  priority: number;
  targetInvoiceId?: string;
  targetCustomerId?: string;
  targetBillId?: string;
}

export interface AlertParams {
  now: string;
  invoices: Invoice[];
  customers: Customer[];
  forecast: ForecastResult;
  bills: Bill[];
  dismissedIds: string[];
  /** Safety floor used to order the collection plan. Defaults to 0 when omitted. */
  safetyFloor?: number;
}

const BILL_WINDOW_DAYS = 7;

/** 'D MMM' display form, e.g. '5 Mar'. */
function shortDate(iso: string): string {
  return format(parseISO(iso), 'd MMM');
}

/** Whether a bill falls due on the given ISO date. */
function billOccursOn(bill: Bill, iso: string): boolean {
  if (bill.recurring === 'once') return bill.onceOn === iso;
  const dom = Number(iso.slice(8, 10));
  // Clamp dueDay 29-31 to the last day of shorter months.
  const isMonthEnd = Number(addDaysISO(iso, 1).slice(8, 10)) === 1;
  return dom === bill.dueDay || (isMonthEnd && bill.dueDay > dom);
}

export function buildAlerts(params: AlertParams): Alert[] {
  const { now, invoices, customers, forecast, bills, dismissedIds, safetyFloor } = params;
  const alerts: Alert[] = [];

  // (a) Chase overdue, sent, unpaid invoices.
  for (const inv of invoices) {
    if (invoiceStatus(inv, now) !== 'overdue') continue;
    const name = customers.find((c) => c.id === inv.customerId)?.name ?? 'customer';
    const due = outstanding(inv);
    const days = daysOverdue(inv, now);
    alerts.push({
      id: `chase-${inv.id}`,
      kind: 'chase',
      title: `Chase ${formatINR(due)} from ${name} today`,
      reason: `${days} days overdue`,
      actionLabel: 'Send reminder',
      priority: Math.min(100, days + due / 1000),
      targetInvoiceId: inv.id,
      targetCustomerId: inv.customerId,
    });
  }

  // (a2) Align chase priorities with the Autopilot collection plan so the
  // Today brief and the "Bad day" plan list invoices in the same order.
  const plan = buildAutopilot({
    now,
    invoices,
    customers,
    lowestBalance: forecast.minBalance,
    safetyFloor: safetyFloor ?? 0,
    maxSteps: 50,
  });
  const rankByInvoice = new Map(plan.steps.map((s) => [s.invoiceId, s.rank]));
  for (const alert of alerts) {
    if (alert.kind !== 'chase' || !alert.targetInvoiceId) continue;
    const rank = rankByInvoice.get(alert.targetInvoiceId);
    // Plan steps sort above every non-plan chase (priority <= 99).
    alert.priority = rank !== undefined ? 100 + (1000 - rank) : Math.min(99, alert.priority);
  }

  // (b) Cash may dip below the safety floor.
  if (forecast.firstBelowFloorDate) {
    alerts.push({
      id: 'cash-dip',
      kind: 'cash-dip',
      title: `Cash may dip below safety floor on ${shortDate(forecast.firstBelowFloorDate)}`,
      reason: `Expected low point ${formatINR(forecast.minBalance)}`,
      actionLabel: 'Review forecast',
      priority: 90,
    });
  }

  // (c) Bills due within the next 7 days (monthly on dueDay, or a one-off on onceOn).
  for (const bill of bills) {
    for (let i = 0; i <= BILL_WINDOW_DAYS; i++) {
      const date = addDaysISO(now, i);
      if (!billOccursOn(bill, date)) continue;
      alerts.push({
        id: `bill-${bill.id}`,
        kind: 'bill-due',
        title: `Pay ${bill.name} ${formatINR(bill.amount)} before ${shortDate(date)}`,
        reason: i === 0 ? 'Due today' : `Due in ${i} day${i === 1 ? '' : 's'}`,
        actionLabel: 'Mark as paid',
        priority: 70,
        targetBillId: bill.id,
      });
      break;
    }
  }

  // (d) Drop dismissed alerts, then sort by priority (highest first).
  const dismissed = new Set(dismissedIds);
  return alerts
    .filter((a) => !dismissed.has(a.id))
    .sort((a, b) => b.priority - a.priority);
}
