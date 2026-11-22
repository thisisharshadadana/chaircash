import { describe, it, expect } from 'vitest';
import { parsePasted } from '../pasteBook';

describe('parsePasted', () => {
  it('parses a WhatsApp payment line', () => {
    const entries = parsePasted('[12/03/26, 10:14] Meera: paid 800 for haircut');
    expect(entries).toHaveLength(1);
    const [entry] = entries;
    expect(entry?.kind).toBe('payment');
    expect(entry?.customerName).toBe('Meera');
    expect(entry?.amount).toBe(800);
    expect(entry?.date).toBe('2026-03-12');
  });

  it('parses an SMS credit alert and takes the name after "from"', () => {
    const entries = parsePasted('Rs.1500 credited to A/c XX1234 from Ravi Kumar');
    expect(entries).toHaveLength(1);
    const [entry] = entries;
    expect(entry?.kind).toBe('payment');
    expect(entry?.customerName).toBe('Ravi Kumar');
    expect(entry?.amount).toBe(1500);
  });

  it('produces no entry for a line with no amount', () => {
    const entries = parsePasted('Meera paid for haircut');
    expect(entries).toHaveLength(0);
  });

  it('falls back to customerName "Unknown" when no name is present', () => {
    const entries = parsePasted('Rs.500 received');
    expect(entries).toHaveLength(1);
    const [entry] = entries;
    expect(entry?.customerName).toBe('Unknown');
    expect(entry?.amount).toBe(500);
  });
});
