import { describe, it, expect } from 'vitest';
import { draftReminder, whatsappLink } from '../reminders';
import { formatINR } from '../money';

describe('whatsappLink', () => {
  it('strips non-digits from phone and encodes text', () => {
    const link = whatsappLink('+91 98765-43210', 'Hi & bye?');
    expect(link).toBe('https://wa.me/919876543210?text=Hi%20%26%20bye%3F');
  });
});

describe('draftReminder', () => {
  it('contains the formatted INR amount', () => {
    const text = draftReminder({
      customerName: 'Meera',
      amount: 1500,
      dueOn: '2026-01-10',
      tone: 'firm',
      businessName: 'Chair Cash',
      daysOverdue: 5,
    });
    expect(text).toContain('₹');
    expect(text).toContain(formatINR(1500));
  });
});
