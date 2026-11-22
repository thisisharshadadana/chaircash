import { describe, it, expect } from 'vitest';
import { buildForecast, type ForecastPoint } from '../forecast';
import type { Bill, Customer, Invoice } from '../types';

const NOW = '2026-03-01';

const customers: Customer[] = [{ id: 'c1', name: 'Asha', phone: '9999999999' }];

function invoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 'i1',
    customerId: 'c1',
    description: 'Tutoring',
    amount: 1000,
    issuedOn: '2026-02-20',
    dueOn: '2026-03-10',
    sent: true,
    payments: [],
    reminders: [],
    ...overrides,
  };
}

function pointOn(points: ForecastPoint[], date: string): ForecastPoint {
  const p = points.find((x) => x.date === date);
  if (!p) throw new Error(`no point for ${date}`);
  return p;
}

describe('buildForecast', () => {
  it('adds the invoice inflow on its due date when probability is 1', () => {
    const result = buildForecast({
      now: NOW,
      horizonDays: 30,
      openingCash: 5000,
      safetyFloor: 2000,
      customers,
      invoices: [invoice()],
      bills: [],
      onTimeProbability: { c1: 1 },
    });

    const due = pointOn(result.points, '2026-03-10');
    expect(due.expectedIn).toBe(1000);
    expect(due.balance).toBe(6000);
    expect(pointOn(result.points, '2026-03-09').balance).toBe(5000);
    expect(result.points).toHaveLength(30);
    expect(result.horizonDays).toBe(30);
  });

  it('pushes the inflow date out by the customer delay', () => {
    const result = buildForecast({
      now: NOW,
      horizonDays: 30,
      openingCash: 5000,
      safetyFloor: 2000,
      customers,
      invoices: [invoice()],
      bills: [],
      onTimeProbability: { c1: 1 },
      delayDaysByCustomer: { c1: 15 },
    });

    expect(pointOn(result.points, '2026-03-10').expectedIn).toBe(0);
    expect(pointOn(result.points, '2026-03-25').expectedIn).toBe(1000);
  });

  it('computes the minimum balance and the first date below the floor', () => {
    const rent: Bill = {
      id: 'b1',
      name: 'Shop rent',
      amount: 4000,
      category: 'rent',
      dueDay: 5,
      recurring: 'monthly',
    };

    const result = buildForecast({
      now: NOW,
      horizonDays: 30,
      openingCash: 5000,
      safetyFloor: 2000,
      customers,
      invoices: [invoice()],
      bills: [rent],
      onTimeProbability: { c1: 1 },
    });

    // 5000 - 4000 on 3 Mar-5 Mar = 1000 (the low point), then +1000 on 10 Mar = 2000.
    expect(result.minBalance).toBe(1000);
    expect(result.minBalanceDate).toBe('2026-03-05');
    expect(result.firstBelowFloorDate).toBe('2026-03-05');
  });

  it('returns null for firstBelowFloorDate when cash never dips', () => {
    const result = buildForecast({
      now: NOW,
      horizonDays: 30,
      openingCash: 50000,
      safetyFloor: 2000,
      customers,
      invoices: [],
      bills: [],
      onTimeProbability: {},
    });

    expect(result.firstBelowFloorDate).toBeNull();
    expect(result.minBalance).toBe(50000);
  });
});
