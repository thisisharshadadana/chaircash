import { formatINR } from './money';

export type Tone = 'friendly' | 'firm' | 'final';

export interface ReminderParams {
  customerName: string;
  amount: number;
  dueOn: string;
  tone: Tone;
  businessName: string;
  daysOverdue: number;
}

export function draftReminder(params: ReminderParams): string {
  const { customerName, amount, dueOn, tone, businessName, daysOverdue } = params;
  const amt = formatINR(amount);

  switch (tone) {
    case 'friendly':
      return (
        `Hi ${customerName}, this is ${businessName}. A friendly reminder that ${amt} ` +
        `was due on ${dueOn}. If you have already paid, please ignore this message. ` +
        `Thank you!`
      );
    case 'firm':
      return (
        `Hello ${customerName}, this is ${businessName}. Our records show ${amt} ` +
        `has been pending for ${daysOverdue} days since ${dueOn}. ` +
        `Please arrange the payment at the earliest, or reply to let us know when to expect it.`
      );
    case 'final':
      return (
        `Dear ${customerName}, this is ${businessName}. This is our final reminder that ${amt} ` +
        `is now ${daysOverdue} days overdue (due ${dueOn}). ` +
        `Please clear the balance or contact us today so we can agree on a way forward.`
      );
  }
}

export function whatsappLink(phone: string, text: string): string {
  const digits = phone.replace(/\D/g, '');
  return 'https://wa.me/' + digits + '?text=' + encodeURIComponent(text);
}
