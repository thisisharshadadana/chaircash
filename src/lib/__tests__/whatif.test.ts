import { describe, it, expect } from 'vitest';
import { buildSeed } from '../../seed';
import { toISODate, today } from '../dates';
import { reliabilityScore } from '../reliability';
import { runScenario } from '../scenarios';
import { outstanding } from '../money';

describe('what-if on seed data', () => {
  it('late key customer moves the dip', () => {
    const now = toISODate(today());
    const { customers, invoices, bills, settings } = buildSeed(now);

    const onTimeProbability: Record<string, number> = {};
    let keyCustomerId: string | null = null;
    let lowestScore = Number.POSITIVE_INFINITY;
    let topCustomerId: string | null = null;
    let topOwed = -1;

    for (const c of customers) {
      const mine = invoices.filter((inv) => inv.customerId === c.id);
      if (mine.length === 0) continue;

      const rel = reliabilityScore(mine, now);
      onTimeProbability[c.id] = rel.score;
      if (rel.score < lowestScore) {
        lowestScore = rel.score;
        keyCustomerId = c.id;
      }

      const owed = mine.filter((inv) => inv.sent).reduce((sum, inv) => sum + outstanding(inv), 0);
      if (owed > topOwed) {
        topOwed = owed;
        topCustomerId = c.id;
      }
    }

    expect(keyCustomerId).not.toBeNull();
    expect(topCustomerId).not.toBeNull();

    const result = runScenario(
      'late-key-customer',
      {
        now,
        horizonDays: 90,
        openingCash: settings.openingCash,
        safetyFloor: settings.safetyFloor,
        customers,
        invoices,
        bills,
        onTimeProbability,
      },
      keyCustomerId as string,
      topCustomerId as string,
    );

    expect(result.balanceOnKeyDueDelta).not.toBeNull();
    expect(result.balanceOnKeyDueDelta as number).toBeLessThan(0);
  });
});
