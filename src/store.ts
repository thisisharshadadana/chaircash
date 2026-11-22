import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Bill, Customer, Invoice, Payment, Reminder, Settings } from './lib/types';
import type { Tone } from './lib/reminders';
import type { QuickAddDraft } from './lib/parseQuickAdd';
import { addDaysISO, toISODate, today } from './lib/dates';
import { buildSeed } from './seed';

export interface AppState {
  customers: Customer[];
  invoices: Invoice[];
  bills: Bill[];
  settings: Settings;
  dismissedAlertIds: string[];
  badDayMode: boolean;
  /** key: `${billId}:${yyyy-mm}` */
  paidBillMonths: Record<string, true>;

  addCustomer: (input: { name: string; phone: string }) => string;
  addInvoice: (input: {
    customerId: string;
    description: string;
    amount: number;
    dueOn: string;
  }) => string;
  markSent: (invoiceId: string) => void;
  recordPayment: (invoiceId: string, amount: number, paidOn: string) => void;
  addReminder: (invoiceId: string, tone: Tone) => void;
  addBill: (input: Omit<Bill, 'id'>) => string;
  markBillPaid: (billId: string, yyyyMm: string) => void;
  dismissAlert: (id: string) => void;
  toggleBadDayMode: () => void;
  quickAdd: (draft: QuickAddDraft) => string;
  updateSettings: (partial: Partial<Settings>) => void;
  resetDemo: () => void;
}

function genId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      customers: [],
      invoices: [],
      bills: [],
      settings: { openingCash: 0, safetyFloor: 0 },
      dismissedAlertIds: [],
      badDayMode: false,
      paidBillMonths: {},

      addCustomer: (input) => {
        const id = genId('cus');
        const customer: Customer = { id, name: input.name, phone: input.phone };
        set((s) => ({ customers: [...s.customers, customer] }));
        return id;
      },

      addInvoice: (input) => {
        const id = genId('inv');
        const invoice: Invoice = {
          id,
          customerId: input.customerId,
          description: input.description,
          amount: input.amount,
          issuedOn: toISODate(today()),
          dueOn: input.dueOn,
          sent: false,
          payments: [],
          reminders: [],
        };
        set((s) => ({ invoices: [...s.invoices, invoice] }));
        return id;
      },

      markSent: (invoiceId) => {
        set((s) => ({
          invoices: s.invoices.map((inv) =>
            inv.id === invoiceId ? { ...inv, sent: true } : inv,
          ),
        }));
      },

      recordPayment: (invoiceId, amount, paidOn) => {
        const payment: Payment = { id: genId('pay'), invoiceId, amount, paidOn };
        set((s) => ({
          invoices: s.invoices.map((inv) =>
            inv.id === invoiceId ? { ...inv, payments: [...inv.payments, payment] } : inv,
          ),
        }));
      },

      addReminder: (invoiceId, tone) => {
        const reminder: Reminder = {
          id: genId('rem'),
          invoiceId,
          tone,
          sentOn: toISODate(today()),
        };
        set((s) => ({
          invoices: s.invoices.map((inv) =>
            inv.id === invoiceId ? { ...inv, reminders: [...inv.reminders, reminder] } : inv,
          ),
        }));
      },

      addBill: (input) => {
        const id = genId('bill');
        const bill: Bill = { ...input, id };
        set((s) => ({ bills: [...s.bills, bill] }));
        return id;
      },

      markBillPaid: (billId, yyyyMm) => {
        const key = `${billId}:${yyyyMm}`;
        set((s) => ({ paidBillMonths: { ...s.paidBillMonths, [key]: true } }));
      },

      dismissAlert: (id) => {
        set((s) =>
          s.dismissedAlertIds.includes(id)
            ? s
            : { dismissedAlertIds: [...s.dismissedAlertIds, id] },
        );
      },

      toggleBadDayMode: () => {
        set((s) => ({ badDayMode: !s.badDayMode }));
      },

      quickAdd: (draft) => {
        const wanted = draft.customerName.trim().toLowerCase();
        const existing = get().customers.find(
          (c) => c.name.trim().toLowerCase() === wanted,
        );
        const customerId = existing ? existing.id : get().addCustomer({ name: draft.customerName.trim(), phone: '' });

        const description =
          draft.quantity > 1 ? `${draft.quantity} x ${draft.description}` : draft.description;
        const dueOn = addDaysISO(toISODate(today()), draft.dueDays);

        const invoiceId = get().addInvoice({
          customerId,
          description,
          amount: draft.amount,
          dueOn,
        });
        get().markSent(invoiceId);
        return invoiceId;
      },

      updateSettings: (partial) => {
        set((s) => ({ settings: { ...s.settings, ...partial } }));
      },

      resetDemo: () => {
        const { customers, invoices, bills, settings } = buildSeed(toISODate(today()));
        set({
          customers,
          invoices,
          bills,
          settings,
          dismissedAlertIds: [],
          badDayMode: false,
          paidBillMonths: {},
        });
      },
    }),
    { name: 'chaircash-v2' },
  ),
);
