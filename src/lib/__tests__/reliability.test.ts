import { describe, it, expect } from 'vitest';
import { reliabilityScore } from '../reliability';

describe('reliabilityScore', () => {
  it('returns New when fewer than 2 invoices are paid', () => {
    const result = reliabilityScore([], '2026-01-31');
    expect(result.label).toBe('New');
    expect(result.score).toBe(0.5);
    expect(result.avgDaysToPay).toBeNull();
    expect(result.onTimePct).toBeNull();
  });
});
