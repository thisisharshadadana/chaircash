import { describe, it, expect } from 'vitest';
import { parseQuickAdd } from '../parseQuickAdd';

describe('parseQuickAdd', () => {
  it('parses quantity, description, amount and due days', () => {
    expect(parseQuickAdd('Meera 2 haircut 800 due 15 days')).toEqual({
      customerName: 'Meera',
      quantity: 2,
      description: 'haircut',
      amount: 800,
      dueDays: 15,
    });
  });

  it('defaults quantity to 1 and dueDays to 7', () => {
    expect(parseQuickAdd('Ravi facial 1500')).toEqual({
      customerName: 'Ravi',
      quantity: 1,
      description: 'facial',
      amount: 1500,
      dueDays: 7,
    });
  });

  it('strips ₹ and commas from amounts', () => {
    expect(parseQuickAdd('Ravi facial ₹1,500')?.amount).toBe(1500);
  });

  it('returns null when no amount is found', () => {
    expect(parseQuickAdd('Meera haircut')).toBeNull();
  });
});
