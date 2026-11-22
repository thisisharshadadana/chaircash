import { describe, it, expect } from 'vitest';
import { buildDecisionOptions, type DecisionParams } from '../decisions';
import { buildForecast, type ForecastResult } from '../forecast';
import { reliabilityScore } from '../reliability';
import { outstanding } from '../money';
import { buildSeed } from '../../seed';
import type { Invoice } from '../types';

const now = '2026-11-22';

function topCustomerIdOf(
  customers: { id: string }[],
  invoices: Invoice[],
): string | null {
  let topId: string | null = null;
  let best = -1;
  for (const c of customers) {
    const owed = invoices
      .filter((i) => i.customerId === c.id && i.sent)
      .reduce((sum, i) => sum + outstanding(i), 0);
    if (owed > best) {
      best = owed;
      topId = c.id;
    }
  }
  return topId;
}

const seed = buildSeed(now);

const onTimeProbability: Record<string, number> = {};
for (const c of seed.customers) {
  const customerInvoices = seed.invoices.filter((i) => i.customerId === c.id);
  onTimeProbability[c.id] = reliabilityScore(customerInvoices, now).score;
}

const base: DecisionParams = {
  now,
  horizonDays: 30,
  openingCash: seed.settings.openingCash,
  safetyFloor: seed.settings.safetyFloor,
  customers: seed.customers,
  invoices: seed.invoices,
  bills: seed.bills,
  onTimeProbability,
  topOwingCustomerId: topCustomerIdOf(seed.customers, seed.invoices),
};

function baselineFor(p: DecisionParams): ForecastResult {
  return buildForecast({
    now: p.now,
    horizonDays: p.horizonDays,
    openingCash: p.openingCash,
    safetyFloor: p.safetyFloor,
    customers: p.customers,
    invoices: p.invoices,
    bills: p.bills,
    onTimeProbability: p.onTimeProbability,
  });
}

describe('decision options fix', () => {
  it('deferring the supplier bill never lowers the low point', () => {
    const baseline = baselineFor(base);
    const defer = buildDecisionOptions(base).find((o) => o.id === 'defer-supplier-bill');
    if (!defer) throw new Error('defer option missing');
    expect(defer.minBalanceAfter).toBeGreaterThanOrEqual(baseline.minBalance);
  });

  it('early-payment discount is not offered when the customer is already expected before the low point', () => {
    const early = buildDecisionOptions(base).find((o) => o.id === 'early-pay-discount');
    if (!early) throw new Error('early-pay option missing');
    expect(early.cost).toBe(0);
    expect(early.explanation.startsWith("Won't help")).toBe(true);
  });

  it.each([0, 25000, 60000])(
    'deferral never lowers the low point with openingCash %i',
    (openingCash) => {
      const p: DecisionParams = { ...base, openingCash };
      const baseline = baselineFor(p);
      const defer = buildDecisionOptions(p).find((o) => o.id === 'defer-supplier-bill');
      if (!defer) throw new Error('defer option missing');
      expect(defer.minBalanceAfter).toBeGreaterThanOrEqual(baseline.minBalance);
    },
  );
});
