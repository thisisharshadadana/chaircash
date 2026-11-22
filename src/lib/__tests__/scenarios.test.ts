import { describe, it, expect } from 'vitest';
import { buildForecast } from '../forecast';
import { runScenario } from '../scenarios';
import type { Bill, Customer, Invoice } from '../types';

const NOW = '2026-03-01';

const customers: Customer[] = [
  { id: 'c1', name: 'Asha', phone: '9999999999' },
  { id: 'c2', name: 'Ravi', phone: '8888888888' },
];

const invoices: Invoice[] = [
  {
    id: 'i1',
    customerId: 'c1',
    description: 'Tutoring',
    amount: 1000,
    issuedOn: '2026-02-20',
    dueOn: '2026-03-10',
    sent: true,
    payments: [],
    reminders: [],
  },
];

const rent: Bill = {
  id: 'b1',
  name: 'Shop rent',
  amount: 10000,
  category: 'rent',
  dueDay: 5,
  recurring: 'monthly',
};

function sumOut(points: { expectedOut: number }[]): number {
  return points.reduce((s, p) => s + p.expectedOut, 0);
}

function sumIn(points: { expectedIn: number }[]): number {
  return points.reduce((s, p) => s + p.expectedIn, 0);
}

const base: Parameters<typeof buildForecast>[0] = {
  now: NOW,
  horizonDays: 90,
  openingCash: 20000,
  safetyFloor: 5000,
  customers,
  invoices,
  bills: [rent],
  onTimeProbability: { c1: 1, c2: 0.5 },
};

describe('runScenario', () => {
  it('rent-up-10 raises total rent outflow by 10% over the horizon', () => {
    const result = runScenario('rent-up-10', base, 'c1', 'c2');

    // Rent falls on 5 Mar, 5 Apr and 5 May within a 90-day horizon from 1 Mar.
    const baseOut = sumOut(result.baseline.points);
    const scenarioOut = sumOut(result.scenario.points);
    expect(baseOut).toBe(30000);
    expect(scenarioOut - baseOut).toBe(Math.round(0.1 * baseOut));
    expect(result.id).toBe('rent-up-10');
    expect(result.label.length).toBeGreaterThan(0);
  });

  it('late-key-customer does not improve the minimum balance when the invoice is the only inflow', () => {
    const result = runScenario('late-key-customer', base, 'c1', 'c2');

    expect(result.minBalanceDelta).toBeLessThanOrEqual(0);
    // Same total inflow, just later.
    expect(sumIn(result.scenario.points)).toBe(sumIn(result.baseline.points));
  });

  it('two-new-clients adds ₹3000 on day 0, 30 and 60 of the horizon', () => {
    const result = runScenario('two-new-clients', base, 'c1', 'c2');

    const extra = sumIn(result.scenario.points) - sumIn(result.baseline.points);
    // Two clients x ₹3000 x three occurrences inside a 90-day horizon.
    expect(extra).toBe(18000);
  });

  it('top-customer-churn removes the excluded customer inflow', () => {
    // c1 is the top customer here (the only one with an invoice), so churn removes it.
    const result = runScenario('top-customer-churn', base, 'c2', 'c1');

    expect(sumIn(result.baseline.points)).toBe(1000);
    expect(sumIn(result.scenario.points)).toBe(0);
  });
});
