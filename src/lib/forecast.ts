import type { Bill, Customer, Invoice } from './types';
import { addDaysISO, daysBetween } from './dates';
import { outstanding } from './money';

export interface ForecastPoint {
  date: string;
  expectedIn: number;
  expectedOut: number;
  balance: number;
  /** ± amount for the shaded band; grows with horizon */
  lowConfidenceBand: number;
}

export interface ForecastResult {
  points: ForecastPoint[];
  minBalance: number;
  minBalanceDate: string;
  firstBelowFloorDate: string | null;
  horizonDays: number;
  /** balance at day 0 (today) after that day's flows */
  todayBalance: number;
  /** minimum balance over days 1..horizon (tomorrow onward), rounded */
  lowFromTomorrow: number;
  lowFromTomorrowDate: string;
  /** first date >= tomorrow whose balance is below the safety floor, or null */
  dipFromTomorrowDate: string | null;
}

export interface ForecastParams {
  /** ISO yyyy-mm-dd, today */
  now: string;
  horizonDays: 30 | 60 | 90;
  openingCash: number;
  safetyFloor: number;
  customers: Customer[];
  invoices: Invoice[];
  bills: Bill[];
  /** customerId -> 0..1 */
  onTimeProbability: Record<string, number>;
  /** extra days added to a customer's expected payment (used by scenarios) */
  delayDaysByCustomer?: Record<string, number>;
  /** invoice id -> ISO date the payment is expected; overrides the default date (never before tomorrow) */
  expectedOverride?: Record<string, string>;
  /** extra recurring inflows, expected on startDay, startDay+30, startDay+60 */
  extraMonthlyInflows?: { amount: number; startDay: number }[];
  rentIncreasePct?: number;
  /** customers to ignore entirely (churn scenario) */
  excludeCustomerIds?: string[];
}

const DEFAULT_ON_TIME_PROBABILITY = 0.7;
const DEFAULT_DAYS_LATE = 3;

/** customerId -> rounded mean days paid after due date, over fully paid sent invoices. */
function averageDaysLateByCustomer(invoices: Invoice[]): Map<string, number> {
  const sums = new Map<string, { total: number; n: number }>();
  for (const inv of invoices) {
    if (!inv.sent || inv.payments.length === 0 || outstanding(inv) > 0) continue;
    const lastPaidOn = inv.payments.reduce(
      (latest, p) => (p.paidOn > latest ? p.paidOn : latest),
      inv.payments[0].paidOn,
    );
    const entry = sums.get(inv.customerId) ?? { total: 0, n: 0 };
    entry.total += daysBetween(inv.dueOn, lastPaidOn);
    entry.n += 1;
    sums.set(inv.customerId, entry);
  }
  const avg = new Map<string, number>();
  sums.forEach((entry, customerId) => {
    avg.set(customerId, Math.round(entry.total / entry.n));
  });
  return avg;
}

/**
 * ISO date an invoice is expected to be paid. `customers` is accepted for API symmetry;
 * the lateness history is derived from `invoices`.
 */
export function expectedReceiptDate(
  inv: Invoice,
  customers: Customer[],
  invoices: Invoice[],
  now: string,
  delayDays: number,
  override?: string,
): string {
  const tomorrow = addDaysISO(now, 1);
  if (override !== undefined) {
    return override < tomorrow ? tomorrow : override;
  }
  if (inv.dueOn < now) {
    // Overdue: expect it after the customer's historical lateness, at least tomorrow.
    const avgLateByCustomer = averageDaysLateByCustomer(invoices);
    const lateDays = Math.max(1, avgLateByCustomer.get(inv.customerId) ?? DEFAULT_DAYS_LATE);
    return addDaysISO(now, lateDays + delayDays);
  }
  return addDaysISO(inv.dueOn, delayDays);
}

export function buildForecast(params: ForecastParams): ForecastResult {
  const {
    now,
    horizonDays,
    openingCash,
    safetyFloor,
    invoices,
    bills,
    onTimeProbability,
    delayDaysByCustomer = {},
    expectedOverride = {},
    extraMonthlyInflows = [],
    rentIncreasePct,
    excludeCustomerIds = [],
  } = params;

  // `customers` is accepted for API symmetry; amounts come from invoices/bills.
  const inflow = new Array<number>(horizonDays).fill(0);
  const outflow = new Array<number>(horizonDays).fill(0);
  const dates: string[] = [];
  for (let i = 0; i < horizonDays; i++) dates.push(addDaysISO(now, i));
  const addAt = (arr: number[], idx: number, amount: number): void => {
    if (idx >= 0 && idx < horizonDays) arr[idx] += amount;
  };

  // Inflows: outstanding amount of each sent, unpaid invoice, weighted by on-time probability.
  const excluded = new Set(excludeCustomerIds);
  const probsUsed: number[] = [];
  for (const inv of invoices) {
    if (!inv.sent || excluded.has(inv.customerId)) continue;
    const due = outstanding(inv);
    if (due <= 0) continue;

    const delay = delayDaysByCustomer[inv.customerId] ?? 0;
    const expected = expectedReceiptDate(
      inv,
      params.customers,
      invoices,
      now,
      delay,
      expectedOverride[inv.id],
    );

    const p = onTimeProbability[inv.customerId] ?? DEFAULT_ON_TIME_PROBABILITY;
    probsUsed.push(p);
    addAt(inflow, daysBetween(now, expected), Math.round(due * p));
  }

  for (const extra of extraMonthlyInflows) {
    const amt = Math.round(extra.amount);
    for (let k = 0; k < 3; k++) addAt(inflow, extra.startDay + 30 * k, amt);
  }

  // Outflows: bills.
  for (const bill of bills) {
    const raw =
      bill.category === 'rent' && rentIncreasePct !== undefined
        ? bill.amount * (1 + rentIncreasePct / 100)
        : bill.amount;
    const amt = Math.round(raw);

    if (bill.recurring === 'monthly') {
      for (let i = 0; i < horizonDays; i++) {
        const dom = Number(dates[i].slice(8, 10));
        // Clamp dueDay 29-31 to the last day of shorter months.
        const isMonthEnd = Number(addDaysISO(dates[i], 1).slice(8, 10)) === 1;
        if (dom === bill.dueDay || (isMonthEnd && bill.dueDay > dom)) {
          outflow[i] += amt;
        }
      }
    } else if (bill.onceOn) {
      // Past one-time bills fall before the horizon and are ignored by addAt.
      addAt(outflow, daysBetween(now, bill.onceOn), amt);
    }
  }

  // Lookahead: total inflow scheduled strictly after each day.
  const sumAfter = new Array<number>(horizonDays).fill(0);
  let running = 0;
  for (let i = horizonDays - 1; i >= 0; i--) {
    sumAfter[i] = running;
    running += inflow[i];
  }

  const avgProbability =
    probsUsed.length > 0
      ? probsUsed.reduce((a, b) => a + b, 0) / probsUsed.length
      : DEFAULT_ON_TIME_PROBABILITY;

  const points: ForecastPoint[] = [];
  let balance = Math.round(openingCash);
  for (let i = 0; i < horizonDays; i++) {
    balance += inflow[i] - outflow[i];
    points.push({
      date: dates[i],
      expectedIn: inflow[i],
      expectedOut: outflow[i],
      balance,
      // Band = future inflows x (1 - avg probability) x 0.5: a simple, documented
      // heuristic so the uncertainty shading widens the further out the money is due.
      lowConfidenceBand: Math.round(sumAfter[i] * (1 - avgProbability) * 0.5),
    });
  }

  let minBalance = Number.POSITIVE_INFINITY;
  let minBalanceDate = now;
  for (const p of points) {
    if (p.balance < minBalance) {
      minBalance = p.balance;
      minBalanceDate = p.date;
    }
  }

  const firstBelow = points.find((p) => p.balance < safetyFloor);

  // Today's shortfall is reported separately; the dip is measured from tomorrow onward.
  const todayBalance = points[0]?.balance ?? Math.round(openingCash);
  let lowFromTomorrow = todayBalance;
  let lowFromTomorrowDate = now;
  let dipFromTomorrow: ForecastPoint | undefined;
  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    if (i === 1 || p.balance < lowFromTomorrow) {
      lowFromTomorrow = p.balance;
      lowFromTomorrowDate = p.date;
    }
    if (dipFromTomorrow === undefined && p.balance < safetyFloor) dipFromTomorrow = p;
  }

  return {
    points,
    minBalance,
    minBalanceDate,
    firstBelowFloorDate: firstBelow ? firstBelow.date : null,
    horizonDays,
    todayBalance,
    lowFromTomorrow: Math.round(lowFromTomorrow),
    lowFromTomorrowDate,
    dipFromTomorrowDate: dipFromTomorrow ? dipFromTomorrow.date : null,
  };
}
