import type { Bill, Customer, Invoice, Payment, Reminder, Settings } from './lib/types';
import { addDaysISO } from './lib/dates';

/**
 * Sample data for "Anjali's Studio", a small salon.
 * All dates are offsets from `now` (an ISO yyyy-mm-dd string, "today").
 */
export function buildSeed(now: string): {
  customers: Customer[];
  invoices: Invoice[];
  bills: Bill[];
  settings: Settings;
} {
  const d = (n: number): string => addDaysISO(now, n);

  const customers: Customer[] = [
    { id: 'cus-001', name: 'Meera Iyer', phone: '9876543210' },
    { id: 'cus-002', name: 'Shubh Weddings', phone: '9810012345' },
    { id: 'cus-003', name: 'Ravi Kumar', phone: '9123456780' },
    { id: 'cus-004', name: 'Priya Sharma', phone: '9988776655' },
    { id: 'cus-005', name: 'Sunita Devi', phone: '9871234560' },
    { id: 'cus-006', name: 'Arjun Mehta', phone: '9895511223' },
    { id: 'cus-007', name: 'Kavya Nair', phone: '9446677889' },
    { id: 'cus-008', name: 'Rohit Verma', phone: '9612345678' },
  ];

  const make = (p: {
    id: string;
    customerId: string;
    description: string;
    amount: number;
    dueOffset: number;
    sent: boolean;
    payments?: Payment[];
    reminders?: Reminder[];
  }): Invoice => ({
    id: p.id,
    customerId: p.customerId,
    description: p.description,
    amount: p.amount,
    issuedOn: d(p.dueOffset - 14),
    dueOn: d(p.dueOffset),
    sent: p.sent,
    payments: p.payments ?? [],
    reminders: p.reminders ?? [],
  });

  const invoices: Invoice[] = [
    // Paid, on time.
    make({
      id: 'inv-001',
      customerId: 'cus-001',
      description: 'Haircut and blow dry',
      amount: 800,
      dueOffset: -70,
      sent: true,
      payments: [{ id: 'pay-001', invoiceId: 'inv-001', amount: 800, paidOn: d(-72) }],
    }),
    // Shubh Weddings (bridal party): consistently pays 15 days after dueOn (low reliability).
    make({
      id: 'inv-002',
      customerId: 'cus-002',
      description: 'Brand shoot grooming (x4)',
      amount: 12000,
      dueOffset: -60,
      sent: true,
      payments: [
        {
          id: 'pay-002',
          invoiceId: 'inv-002',
          amount: 12000,
          paidOn: addDaysISO(d(-60), 15),
        },
      ],
    }),
    make({
      id: 'inv-003',
      customerId: 'cus-002',
      description: 'Campaign makeup session',
      amount: 9500,
      dueOffset: -45,
      sent: true,
      payments: [
        {
          id: 'pay-003',
          invoiceId: 'inv-003',
          amount: 9500,
          paidOn: addDaysISO(d(-45), 15),
        },
      ],
    }),
    make({
      id: 'inv-004',
      customerId: 'cus-002',
      description: 'Monthly grooming retainer',
      amount: 15000,
      dueOffset: -30,
      sent: true,
      payments: [
        {
          id: 'pay-004',
          invoiceId: 'inv-004',
          amount: 15000,
          paidOn: addDaysISO(d(-30), 15),
        },
      ],
    }),
    // Overdue ~12 days, Shubh Weddings, with one friendly reminder.
    make({
      id: 'inv-005',
      customerId: 'cus-002',
      description: 'Product launch styling',
      amount: 18000,
      dueOffset: -12,
      sent: true,
      reminders: [{ id: 'rem-001', invoiceId: 'inv-005', tone: 'friendly', sentOn: d(-9) }],
    }),
    // Overdue ~3 days.
    make({
      id: 'inv-006',
      customerId: 'cus-003',
      description: 'Beard trim and facial',
      amount: 1500,
      dueOffset: -3,
      sent: true,
    }),
    // Part-paid, overdue ~35 days, with two reminders.
    make({
      id: 'inv-007',
      customerId: 'cus-004',
      description: 'Bridal package advance',
      amount: 10000,
      dueOffset: -35,
      sent: true,
      payments: [{ id: 'pay-005', invoiceId: 'inv-007', amount: 4000, paidOn: d(-38) }],
      reminders: [
        { id: 'rem-002', invoiceId: 'inv-007', tone: 'friendly', sentOn: d(-30) },
        { id: 'rem-003', invoiceId: 'inv-007', tone: 'firm', sentOn: d(-20) },
      ],
    }),
    // Overdue ~70 days, unpaid, final reminder.
    make({
      id: 'inv-008',
      customerId: 'cus-005',
      description: 'Full hair colour',
      amount: 2200,
      dueOffset: -70,
      sent: true,
      reminders: [{ id: 'rem-004', invoiceId: 'inv-008', tone: 'final', sentOn: d(-40) }],
    }),
    // Paid on time.
    make({
      id: 'inv-009',
      customerId: 'cus-006',
      description: 'Groom grooming package',
      amount: 3500,
      dueOffset: -12,
      sent: true,
      payments: [{ id: 'pay-006', invoiceId: 'inv-009', amount: 3500, paidOn: d(-13) }],
    }),
    // Part-paid, sent, not yet due.
    make({
      id: 'inv-010',
      customerId: 'cus-007',
      description: 'Keratin treatment',
      amount: 6000,
      dueOffset: 5,
      sent: true,
      payments: [{ id: 'pay-007', invoiceId: 'inv-010', amount: 2000, paidOn: d(-2) }],
    }),
    // Recent, unpaid, sent, not yet due.
    make({
      id: 'inv-011',
      customerId: 'cus-008',
      description: 'Wedding party makeup booking',
      amount: 8000,
      dueOffset: 10,
      sent: true,
    }),
    // Not yet sent (draft).
    make({
      id: 'inv-012',
      customerId: 'cus-001',
      description: 'Manicure and pedicure',
      amount: 1200,
      dueOffset: 7,
      sent: false,
    }),
  ];

  const bills: Bill[] = [
    {
      id: 'bill-rent',
      name: 'Rent',
      amount: 25000,
      category: 'rent',
      dueDay: 1,
      recurring: 'monthly',
    },
    {
      id: 'bill-salary',
      name: 'Staff salary',
      amount: 18000,
      category: 'salary',
      dueDay: 5,
      recurring: 'monthly',
    },
    {
      id: 'bill-supplier',
      name: 'Product supplier',
      amount: 6000,
      category: 'supplier',
      dueDay: 12,
      recurring: 'monthly',
    },
    {
      id: 'bill-electricity',
      name: 'Electricity',
      amount: 2500,
      category: 'utility',
      dueDay: 9,
      recurring: 'monthly',
    },
  ];

  const settings: Settings = { openingCash: 60000, safetyFloor: 25000 };

  return { customers, invoices, bills, settings };
}
