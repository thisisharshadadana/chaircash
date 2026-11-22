import type { Bill, Customer, Invoice } from './types';
import { addDaysISO, daysBetween } from './dates';
import { outstanding } from './money';

export interface MonteCarloResult {
  runs: number;
  /** 0..1, share of runs where balance drops below safetyFloor on any day in horizon */
  probBelowFloor: number;
  /** 0..1, share of runs where balance < 0 on any day */
  probCannotCoverBills: number;
  p10MinBalance: number;
  p50MinBalance: number;
  p90MinBalance: number;
  /** most common date of the minimum balance across runs */
  worstDate: string | null;
}

export interface SimulateParams {
  now: string;
  horizonDays: number;
  openingCash: number;
  safetyFloor: number;
  customers: Customer[];
  invoices: Invoice[];
  bills: Bill[];
  runs?: number;
  seed?: number;
  /** 0..1 per customer id: chance an unpaid invoice is received within the horizon. Missing customers default to 0.7. */
  onTimeProbability?: Record<string, number>;
}

/** [delayDays, weight] */
const DEFAULT_DELAYS: Array<[number, number]> = [
  [-2, 0.2],
  [0, 0.4],
  [7, 0.25],
  [15, 0.15],
];

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWeighted(rand: () => number, items: Array<[number, number]>): number {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [value, w] of items) {
    r -= w;
    if (r < 0) return value;
  }
  return items[items.length - 1][0];
}

function daysInMonth(iso: string): number {
  return new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)), 0).getDate();
}

export function simulateCash(params: SimulateParams): MonteCarloResult {
  const { now, horizonDays, openingCash, safetyFloor, customers, invoices, bills } = params;
  const onTime = params.onTimeProbability ?? {};
  const runs = Math.max(1, Math.floor(params.runs ?? 5000));
  const rand = mulberry32(params.seed ?? 42);
  const H = Math.max(0, Math.floor(horizonDays));

  // Lateness history per customer: days from dueOn to last payment, for paid invoices.
  const history = new Map<string, number[]>();
  for (const c of customers) history.set(c.id, []);
  for (const inv of invoices) {
    if (!inv.sent || inv.payments.length === 0 || outstanding(inv) > 0) continue;
    const lastPaidOn = inv.payments.reduce((l, p) => (p.paidOn > l ? p.paidOn : l), inv.payments[0].paidOn);
    const list = history.get(inv.customerId) ?? [];
    list.push(daysBetween(inv.dueOn, lastPaidOn));
    history.set(inv.customerId, list);
  }

  // Fixed outflows (bills), indexed by day offset from now (0 = now).
  const billFlow: number[] = new Array<number>(H).fill(0);
  for (const bill of bills) {
    if (bill.recurring === 'monthly') {
      for (let i = 0; i < H; i++) {
        const date = addDaysISO(now, i);
        const dom = Number(date.slice(8, 10));
        if (dom === Math.min(bill.dueDay, daysInMonth(date))) billFlow[i] -= bill.amount;
      }
    } else if (bill.onceOn) {
      const idx = daysBetween(now, bill.onceOn);
      if (idx >= 0 && idx < H) billFlow[idx] -= bill.amount;
    }
  }

  // Unpaid sent invoices with their outstanding amount and customer history.
  const open = invoices
    .filter((inv) => inv.sent && outstanding(inv) > 0)
    .map((inv) => ({
      amount: outstanding(inv),
      dueOn: inv.dueOn,
      hist: history.get(inv.customerId) ?? [],
      onTimeP: onTime[inv.customerId] ?? 0.7,
    }));

  const mins: number[] = [];
  const minDayCounts = new Map<number, number>();
  let belowCount = 0;
  let cannotCount = 0;

  for (let r = 0; r < runs; r++) {
    const flow = billFlow.slice();
    for (const inv of open) {
      // Chance the customer does not pay within the horizon at all.
      if (rand() > inv.onTimeP) continue;
      const delay =
        inv.hist.length >= 2
          ? inv.hist[Math.floor(rand() * inv.hist.length)]
          : pickWeighted(rand, DEFAULT_DELAYS);
      const idx = Math.max(1, daysBetween(now, addDaysISO(inv.dueOn, delay)));
      if (idx < H) flow[idx] += inv.amount;
    }

    let bal = openingCash;
    let minBal = Infinity;
    let minIdx = 0;
    for (let i = 0; i < H; i++) {
      bal += flow[i];
      if (bal < minBal) {
        minBal = bal;
        minIdx = i;
      }
    }

    mins.push(minBal);
    if (minBal < safetyFloor) belowCount++;
    if (minBal < 0) cannotCount++;
    minDayCounts.set(minIdx, (minDayCounts.get(minIdx) ?? 0) + 1);
  }

  const sorted = [...mins].sort((a, b) => a - b);
  const pct = (p: number): number => Math.round(sorted[Math.floor(p * (runs - 1))]);

  let modeIdx = 0;
  let modeCount = -1;
  for (const [idx, count] of minDayCounts) {
    if (count > modeCount) {
      modeIdx = idx;
      modeCount = count;
    }
  }

  return {
    runs,
    probBelowFloor: belowCount / runs,
    probCannotCoverBills: cannotCount / runs,
    p10MinBalance: pct(0.1),
    p50MinBalance: pct(0.5),
    p90MinBalance: pct(0.9),
    worstDate: minDayCounts.size > 0 ? addDaysISO(now, modeIdx) : null,
  };
}
