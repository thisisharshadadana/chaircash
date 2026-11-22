import { describe, it, expect } from 'vitest';
import { buildAlerts, type Alert } from '../alerts';
import type { ForecastResult } from '../forecast';
import type { Customer, Invoice } from '../types';

const NOW = '2026-03-01';

const customers: Customer[] = [{ id: 'c1', name: 'Asha', phone: '9999999999' }];

const overdue: Invoice = {
  id: 'i1',
  customerId: 'c1',
  description: 'Tutoring',
  amount: 1000,
  issuedOn: '2026-02-01',
  dueOn: '2026-02-20',
  sent: true,
  payments: [],
  reminders: [],
};

const calmForecast: ForecastResult = {
  points: [],
  minBalance: 50000,
  minBalanceDate: NOW,
  firstBelowFloorDate: null,
  horizonDays: 30,
  todayBalance: 50000,
  lowFromTomorrow: 50000,
  lowFromTomorrowDate: NOW,
  dipFromTomorrowDate: null,
};

function find(alerts: Alert[], id: string): Alert | undefined {
  return alerts.find((a) => a.id === id);
}

describe('buildAlerts', () => {
  it('creates a chase alert with a deterministic id for an overdue invoice', () => {
    const alerts = buildAlerts({
      now: NOW,
      invoices: [overdue],
      customers,
      forecast: calmForecast,
      bills: [],
      dismissedIds: [],
    });

    const chase = find(alerts, 'chase-i1');
    expect(chase).toBeDefined();
    expect(chase?.kind).toBe('chase');
    expect(chase?.title).toContain('Asha');
    expect(chase?.reason).toBe('9 days overdue');
    expect(chase?.actionLabel).toBe('Send reminder');
    expect(chase?.targetInvoiceId).toBe('i1');
    expect(chase?.targetCustomerId).toBe('c1');
  });

  it('removes alerts whose ids are dismissed', () => {
    const alerts = buildAlerts({
      now: NOW,
      invoices: [overdue],
      customers,
      forecast: calmForecast,
      bills: [],
      dismissedIds: ['chase-i1'],
    });

    expect(find(alerts, 'chase-i1')).toBeUndefined();
    expect(alerts).toHaveLength(0);
  });

  it('does not chase invoices that are not yet due', () => {
    const notDue: Invoice = { ...overdue, id: 'i2', dueOn: '2026-03-15' };
    const alerts = buildAlerts({
      now: NOW,
      invoices: [notDue],
      customers,
      forecast: calmForecast,
      bills: [],
      dismissedIds: [],
    });

    expect(find(alerts, 'chase-i2')).toBeUndefined();
  });

  it('adds a cash-dip alert when the forecast crosses the safety floor', () => {
    const dipping: ForecastResult = {
      ...calmForecast,
      minBalance: 1000,
      minBalanceDate: '2026-03-05',
      firstBelowFloorDate: '2026-03-05',
    };
    const alerts = buildAlerts({
      now: NOW,
      invoices: [],
      customers,
      forecast: dipping,
      bills: [],
      dismissedIds: [],
    });

    const dip = find(alerts, 'cash-dip');
    expect(dip?.kind).toBe('cash-dip');
    expect(dip?.priority).toBe(90);
  });

  it('orders chase alerts the same way as the Autopilot collection plan', () => {
    const customersV: Customer[] = [
      { id: 'cus-v', name: 'Shubh Weddings', phone: '9999999991' },
      { id: 'cus-s', name: 'Sunita Devi', phone: '9999999992' },
    ];
    const invVertex: Invoice = {
      id: 'inv-v',
      customerId: 'cus-v',
      description: 'Campaign',
      amount: 18000,
      issuedOn: '2026-01-18',
      dueOn: '2026-02-17',
      sent: true,
      payments: [],
      reminders: [],
    };
    const invSunita: Invoice = {
      id: 'inv-s',
      customerId: 'cus-s',
      description: 'Saree blouse',
      amount: 2200,
      issuedOn: '2025-12-11',
      dueOn: '2026-01-20',
      sent: true,
      payments: [],
      reminders: [],
    };
    const alerts = buildAlerts({
      now: NOW,
      invoices: [invSunita, invVertex],
      customers: customersV,
      forecast: calmForecast,
      bills: [],
      dismissedIds: [],
    });

    const vertex = find(alerts, 'chase-inv-v');
    const sunita = find(alerts, 'chase-inv-s');
    expect(vertex).toBeDefined();
    expect(sunita).toBeDefined();
    expect(alerts.indexOf(vertex as Alert)).toBeLessThan(alerts.indexOf(sunita as Alert));
    expect(vertex?.priority).toBeGreaterThan(sunita?.priority ?? Number.POSITIVE_INFINITY);
  });

  it('sorts alerts by priority, highest first', () => {
    const dipping: ForecastResult = {
      ...calmForecast,
      minBalance: 1000,
      firstBelowFloorDate: '2026-03-05',
    };
    const alerts = buildAlerts({
      now: NOW,
      invoices: [overdue],
      customers,
      forecast: dipping,
      bills: [],
      dismissedIds: [],
    });

    for (let i = 1; i < alerts.length; i++) {
      expect(alerts[i - 1].priority).toBeGreaterThanOrEqual(alerts[i].priority);
    }
  });
});
