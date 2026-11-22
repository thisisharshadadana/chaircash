import { describe, it, expect } from 'vitest';
import { buildDecisionOptions } from '../decisions';

describe('buildDecisionOptions', () => {
  const options = buildDecisionOptions({
    now: '2026-03-01',
    horizonDays: 30,
    openingCash: 10000,
    safetyFloor: 25000,
    bills: [{ id: 'rent', name: 'Rent', amount: 20000, category: 'rent', dueDay: 5, recurring: 'monthly' }],
    invoices: [],
    customers: [],
    onTimeProbability: {},
    topOwingCustomerId: null,
  });

  it('returns three options', () => {
    expect(options).toHaveLength(3);
  });

  it('short-loan clears the floor', () => {
    const loan = options.find((o) => o.id === 'short-loan');
    expect(loan?.clearsFloor).toBe(true);
  });

  it('early-pay-discount has zero cost and gain with no top debtor', () => {
    const early = options.find((o) => o.id === 'early-pay-discount');
    expect(early?.cost).toBe(0);
    expect(early?.cashGain).toBe(0);
  });

  it('lists options that clear the floor before those that do not', () => {
    let seenFailing = false;
    for (const o of options) {
      if (!o.clearsFloor) seenFailing = true;
      else expect(seenFailing).toBe(false);
    }
  });
});
