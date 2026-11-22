import { formatINR } from './money';

export const DEFAULT_VPA = 'anjali.studio@upi';
export const DEFAULT_PAYEE = "Anjali's Studio";

export function upiLink(params: {
  payeeVpa: string;
  payeeName: string;
  amount: number;
  note: string;
}): string {
  const { payeeVpa, payeeName, amount, note } = params;
  return `upi://pay?pa=${encodeURIComponent(payeeVpa)}&pn=${encodeURIComponent(payeeName)}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(note)}`;
}

export function paymentMessage(params: {
  customerName: string;
  amount: number;
  businessName: string;
  upi: string;
}): string {
  const { customerName, amount, businessName, upi } = params;
  return `Hi ${customerName}, your payment of ${formatINR(amount)} to ${businessName} is due. Pay in one tap: ${upi}. Thank you!`;
}
