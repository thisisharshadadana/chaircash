import { describe, it, expect } from 'vitest';
import { simulateCash } from '../monteCarlo';
import type { Bill, Customer, Invoice } from '../types';

const customers: Customer[] = [{ id: 'c1', name: 'Meera', phone: '9999999999' }];

const invoices: Invoice[] = [
  {
    id: 'i1',
    customerId: 'c1',
    description: 'haircut',
    amount: 800,
    issuedOn: '2026-02-01',
    dueOn: '2026-02-15',
    sent: true,
    payments: [{ id: 'p1', invoiceId: 'i1', amount: 800, paidOn: '2026-02-18' }],
    reminders: [],
  },
  {
    id: 'i2',
    customerId: 'c1',
    description: 'color',
    amount: 2000,
    issuedOn: '2026-02-20',
    dueOn: '2026-03-10',
    sent: true,
    payments: [],
    reminders: [],
  },
];

const rentBill: Bill = {
  id: 'b1',
  name: 'Rent',
  amount: 150000,
  category: 'rent',
  dueDay: 5,
  recurring: 'monthly',
};

describe('simulateCash', () => {
  it('gives identical results for the same seed', () => {
    const params = {
      now: '2026-03-01',
      horizonDays: 30,
      openingCash: 50000,
      safetyFloor: 25000,
      customers,
      invoices,
      bills: [rentBill],
      runs: 500,
      seed: 7,
    };
    expect(simulateCash(params)).toEqual(simulateCash(params));
  });

  it('reports certain floor breach and cannot-cover when a bill exceeds cash with no income', () => {
    const result = simulateCash({
      now: '2026-03-01',
      horizonDays: 30,
      openingCash: 100000,
      safetyFloor: 25000,
      customers,
      invoices: [],
      bills: [rentBill],
      runs: 200,
    });
    expect(result.probBelowFloor).toBe(1);
    expect(result.probCannotCoverBills).toBe(1);
  });

  it('reports zero floor breach when cash is far above the floor and there are no bills', () => {
    const result = simulateCash({
      now: '2026-03-01',
      horizonDays: 30,
      openingCash: 1000000,
      safetyFloor: 25000,
      customers,
      invoices,
      bills: [],
      runs: 200,
    });
    expect(result.probBelowFloor).toBe(0);
  });

  it('raises floor breach when a customer is unlikely to pay in the horizon', () => {
    // Opening 30000, floor 25000. A 10000 bill on 2026-03-29 dips below the floor unless the
    // 20000 invoice (due 2026-03-10, paid by 2026-03-25 at the latest) arrives first.
    const testCustomers: Customer[] = [{ id: 'c1', name: 'Meera', phone: '' }];
    const testBills: Bill[] = [
      { id: 'b2', name: 'Equipment', amount: 10000, category: 'other', recurring: 'once', onceOn: '2026-03-29', dueDay: 1 },
    ];
    const testInvoices: Invoice[] = [
      {
        id: 'i3',
        customerId: 'c1',
        description: 'bridal',
        amount: 20000,
        issuedOn: '2026-02-25',
        dueOn: '2026-03-10',
        sent: true,
        payments: [],
        reminders: [],
      },
    ];
    const base = {
      now: '2026-03-01',
      horizonDays: 30,
      openingCash: 30000,
      safetyFloor: 25000,
      customers: testCustomers,
      invoices: testInvoices,
      bills: testBills,
      runs: 200,
    };
    const never = simulateCash({ ...base, onTimeProbability: { c1: 0 } });
    const always = simulateCash({ ...base, onTimeProbability: { c1: 1 } });
    expect(never.probBelowFloor).toBe(1);
    expect(always.probBelowFloor).toBe(0);
    expect(always.probBelowFloor).toBeLessThan(never.probBelowFloor);
  });
});
