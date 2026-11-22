import { describe, it, expect } from 'vitest';
import { upiLink, paymentMessage, DEFAULT_VPA, DEFAULT_PAYEE } from '../upi';

describe('upiLink', () => {
  const link = upiLink({
    payeeVpa: DEFAULT_VPA,
    payeeName: DEFAULT_PAYEE,
    amount: 800,
    note: 'Haircut',
  });

  it('builds a upi://pay deep link', () => {
    expect(link).toContain('upi://pay?');
  });

  it('encodes the payee VPA', () => {
    expect(link).toContain('pa=anjali.studio%40upi');
  });

  it('formats the amount with two decimals', () => {
    expect(link).toContain('am=800.00');
  });

  it('sets the currency to INR', () => {
    expect(link).toContain('cu=INR');
  });
});

describe('paymentMessage', () => {
  const msg = paymentMessage({
    customerName: 'Meera',
    amount: 800,
    businessName: DEFAULT_PAYEE,
    upi: 'upi://pay?pa=anjali.studio%40upi',
  });

  it('includes the customer name', () => {
    expect(msg).toContain('Meera');
  });

  it('includes the amount formatted in rupees', () => {
    expect(msg).toContain('₹800');
  });
});
