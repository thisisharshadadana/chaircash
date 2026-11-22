import { describe, it, expect } from 'vitest';
import { buildAutopilot } from '../autopilot';
import type { Customer, Invoice } from '../types';

const NOW = '2025-06-30';

const customers: Customer[] = [
  { id: 'c1', name: 'Meera', phone: '919876543210' },
  { id: 'c2', name: 'Ravi', phone: '919812345678' },
];

function invoice(id: string, customerId: string, amount: number, dueOn: string): Invoice {
  return {
    id,
    customerId,
    description: 'Work',
    amount,
    issuedOn: '2025-05-01',
    dueOn,
    sent: true,
    payments: [],
    reminders: [],
  };
}

describe('buildAutopilot', () => {
  it('excludes invoices that are not overdue', () => {
    const plan = buildAutopilot({
      now: NOW,
      invoices: [invoice('i1', 'c1', 5000, '2025-07-10')],
      customers,
      lowestBalance: 10000,
      safetyFloor: 8000,
    });
    expect(plan.steps).toHaveLength(0);
    expect(plan.totalOverdue).toBe(0);
    expect(plan.totalRecoverable).toBe(0);
  });

  it('marks a 40-day-overdue invoice as final tone with a wa.me URL', () => {
    const plan = buildAutopilot({
      now: NOW,
      invoices: [invoice('i1', 'c1', 5000, '2025-05-21')],
      customers,
      lowestBalance: 10000,
      safetyFloor: 8000,
    });
    expect(plan.steps).toHaveLength(1);
    const step = plan.steps[0];
    expect(step.daysOverdue).toBe(40);
    expect(step.tone).toBe('final');
    expect(step.whatsappUrl.startsWith('https://wa.me/')).toBe(true);
  });

  it('ranks a bigger overdue invoice first', () => {
    const plan = buildAutopilot({
      now: NOW,
      invoices: [
        invoice('small', 'c1', 2000, '2025-06-20'),
        invoice('big', 'c2', 9000, '2025-06-20'),
      ],
      customers,
      lowestBalance: 10000,
      safetyFloor: 8000,
    });
    expect(plan.steps[0].invoiceId).toBe('big');
    expect(plan.steps[0].rank).toBe(1);
    expect(plan.steps[1].invoiceId).toBe('small');
    expect(plan.steps[1].cashUnlocked).toBe(11000);
  });

  it('sets coversGap true when recoverable cash exceeds the gap', () => {
    const plan = buildAutopilot({
      now: NOW,
      invoices: [invoice('i1', 'c1', 6000, '2025-06-20')],
      customers,
      lowestBalance: 3000,
      safetyFloor: 8000,
    });
    expect(plan.cashGapToFloor).toBe(5000);
    expect(plan.totalRecoverable).toBe(6000);
    expect(plan.coversGap).toBe(true);
  });
});
