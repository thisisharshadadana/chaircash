import { useState, type FormEvent } from 'react';
import { useStore } from '../store';
import { addDaysISO, toISODate, today } from '../lib/dates';
import { daysOverdue } from '../lib/aging';
import { formatINR, outstanding } from '../lib/money';
import { invoiceStatus, type InvoiceStatus } from '../lib/invoices';
import { draftReminder, whatsappLink, type Tone } from '../lib/reminders';
import { DEFAULT_PAYEE, DEFAULT_VPA, paymentMessage, upiLink } from '../lib/upi';

/** Business name used in reminder text; no settings field exists for it yet. */
const BUSINESS_NAME = 'ChairCash';

const STATUS_CLASS: Record<InvoiceStatus, string> = {
  draft: 'bg-slate-100 text-slate-700',
  sent: 'bg-sky-100 text-sky-800',
  'part-paid': 'bg-amber-100 text-amber-800',
  paid: 'bg-emerald-100 text-emerald-800',
  overdue: 'bg-rose-100 text-rose-800',
};

const TONES: Tone[] = ['friendly', 'firm', 'final'];

export default function Invoices() {
  const customers = useStore((s) => s.customers);
  const invoices = useStore((s) => s.invoices);
  const addInvoice = useStore((s) => s.addInvoice);
  const markSent = useStore((s) => s.markSent);
  const recordPayment = useStore((s) => s.recordPayment);
  const addReminder = useStore((s) => s.addReminder);

  const now = toISODate(today());

  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Create-invoice form state.
  const [customerId, setCustomerId] = useState('');
  const [description, setDescription] = useState('');
  const [amountText, setAmountText] = useState('');
  const [dueOn, setDueOn] = useState(() => addDaysISO(toISODate(today()), 7));

  // Payment form state.
  const [payAmountText, setPayAmountText] = useState('');
  const [paidOn, setPaidOn] = useState(() => toISODate(today()));

  // Reminder preview state.
  const [tone, setTone] = useState<Tone>('friendly');

  const effectiveCustomerId = customerId || customers[0]?.id || '';
  const amount = Number(amountText);
  const canCreate = effectiveCustomerId !== '' && description.trim() !== '' && amount > 0 && dueOn !== '';

  const handleCreate = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    if (!canCreate) return;
    const id = addInvoice({
      customerId: effectiveCustomerId,
      description: description.trim(),
      amount,
      dueOn,
    });
    setSelectedId(id);
    setDescription('');
    setAmountText('');
  };

  const selected = invoices.find((i) => i.id === selectedId) ?? null;
  const selectedCustomer = selected
    ? customers.find((c) => c.id === selected.customerId) ?? null
    : null;

  const payAmount = Number(payAmountText);
  const canRecord = selected !== null && payAmount > 0 && paidOn !== '';

  const handleRecordPayment = (): void => {
    if (!selected || !canRecord) return;
    recordPayment(selected.id, payAmount, paidOn);
    setPayAmountText('');
  };

  const reminderText =
    selected && selectedCustomer
      ? draftReminder({
          customerName: selectedCustomer.name,
          amount: outstanding(selected),
          dueOn: selected.dueOn,
          tone,
          businessName: BUSINESS_NAME,
          daysOverdue: daysOverdue(selected, now),
        })
      : '';
  const waLink = selectedCustomer ? whatsappLink(selectedCustomer.phone, reminderText) : '';

  const selectedOutstanding = selected ? outstanding(selected) : 0;
  const payUpi = selected
    ? upiLink({
        payeeVpa: DEFAULT_VPA,
        payeeName: DEFAULT_PAYEE,
        amount: selectedOutstanding,
        note: selected.description,
      })
    : '';
  const payWaLink =
    selectedCustomer && payUpi
      ? whatsappLink(
          selectedCustomer.phone,
          paymentMessage({
            customerName: selectedCustomer.name,
            amount: selectedOutstanding,
            businessName: DEFAULT_PAYEE,
            upi: payUpi,
          }),
        )
      : '';

  return (
    <div className="space-y-6 p-4">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Invoices</h1>

      <ul className="divide-y divide-slate-200 overflow-hidden rounded-2xl bg-white shadow-sm dark:divide-slate-700 dark:bg-slate-900">
        {invoices.length === 0 && (
          <li className="px-4 py-3 text-sm text-slate-500">No invoices yet.</li>
        )}
        {invoices.map((inv) => {
          const status = invoiceStatus(inv, now);
          const name = customers.find((c) => c.id === inv.customerId)?.name ?? 'Customer';
          return (
            <li key={inv.id}>
              <button
                type="button"
                onClick={() => setSelectedId(inv.id)}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800 ${
                  inv.id === selectedId ? 'bg-slate-100 dark:bg-slate-800' : ''
                }`}
              >
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[status]}`}>
                  {status}
                </span>
                <span className="flex-1 text-slate-900">{name}</span>
                {outstanding(inv) === 0 ? (
                  <span className="text-sm text-slate-700">{formatINR(inv.amount)}</span>
                ) : inv.payments.some((p) => p.amount > 0) ? (
                  <>
                    <span className="text-sm text-slate-700">{formatINR(outstanding(inv))}</span>
                    <span className="text-xs text-slate-500">of {formatINR(inv.amount)}</span>
                  </>
                ) : (
                  <span className="text-sm text-slate-700">{formatINR(inv.amount)}</span>
                )}
                <span className="w-24 text-right text-sm text-slate-500">due {inv.dueOn}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {selected && selectedCustomer && (
        <section className="space-y-4 rounded-2xl bg-white p-5 shadow-sm dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{selected.description}</h2>
              <p className="text-sm text-slate-500">
                {selectedCustomer.name} · {formatINR(selected.amount)} · outstanding{' '}
                {formatINR(outstanding(selected))}
              </p>
            </div>
            {!selected.sent && (
              <button
                type="button"
                onClick={() => markSent(selected.id)}
                className="rounded-full bg-brand-600 px-4 py-1.5 text-sm font-medium text-white transition active:scale-[0.98]"
              >
                Mark sent
              </button>
            )}
          </div>

          {selectedOutstanding > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Pay link</h3>
              <a
                href={payUpi}
                className="block break-all text-sm text-sky-700 underline"
              >
                {payUpi}
              </a>
              <div className="flex flex-wrap gap-2">
                <a
                  href={payWaLink}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block rounded-full bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white transition active:scale-[0.98]"
                >
                  Send on WhatsApp
                </a>
                <button
                  type="button"
                  onClick={() => recordPayment(selected.id, selectedOutstanding, toISODate(today()))}
                  className="rounded-full bg-slate-100 px-4 py-1.5 text-sm font-medium text-slate-700 transition active:scale-[0.98] dark:bg-slate-800 dark:text-slate-200"
                >
                  Mark as paid
                </button>
              </div>
            </div>
          )}

          {selected.sent && outstanding(selected) > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Record payment</h3>
              <div className="flex flex-wrap gap-2">
                <input
                  type="number"
                  min={0}
                  value={payAmountText}
                  placeholder="Amount"
                  onChange={(e) => setPayAmountText(e.target.value)}
                  className="w-32 rounded-xl border-0 bg-slate-100 px-3 py-2 dark:bg-slate-800"
                />
                <input
                  type="date"
                  value={paidOn}
                  onChange={(e) => setPaidOn(e.target.value)}
                  className="rounded-xl border-0 bg-slate-100 px-3 py-2 dark:bg-slate-800 dark:text-slate-100"
                />
                <button
                  type="button"
                  disabled={!canRecord}
                  onClick={handleRecordPayment}
                  className="rounded-full bg-brand-600 px-4 py-2 text-sm font-medium text-white transition active:scale-[0.98] disabled:opacity-40"
                >
                  Record payment
                </button>
              </div>
            </div>
          )}

          {selected.sent && outstanding(selected) > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Reminder</h3>
              <div className="flex gap-2">
                {TONES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTone(t)}
                    className={`rounded-full px-4 py-1.5 text-sm font-medium capitalize transition active:scale-[0.98] ${
                      t === tone ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <textarea
                readOnly
                value={reminderText}
                rows={4}
                className="w-full rounded-xl border-0 bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100"
              />
              <a
                href={waLink}
                target="_blank"
                rel="noreferrer"
                onClick={() => addReminder(selected.id, tone)}
                className="inline-block rounded-full bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white transition active:scale-[0.98]"
              >
                Send on WhatsApp
              </a>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-500">Payments</h3>
              {selected.payments.length === 0 && (
                <p className="text-sm text-slate-400">No payments yet.</p>
              )}
              <ul className="space-y-1 text-sm text-slate-700">
                {selected.payments.map((p) => (
                  <li key={p.id}>
                    {formatINR(p.amount)} on {p.paidOn}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-500">Reminders sent</h3>
              {selected.reminders.length === 0 && (
                <p className="text-sm text-slate-400">No reminders yet.</p>
              )}
              <ul className="space-y-1 text-sm text-slate-700">
                {selected.reminders.map((r) => (
                  <li key={r.id} className="capitalize">
                    {r.tone} on {r.sentOn}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      <form onSubmit={handleCreate} className="space-y-3 rounded-2xl bg-white p-5 shadow-sm dark:bg-slate-900">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">New invoice</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <select
            value={effectiveCustomerId}
            onChange={(e) => setCustomerId(e.target.value)}
            className="rounded-xl border-0 bg-slate-100 px-3 py-2 dark:bg-slate-800 dark:text-slate-100"
          >
            {customers.length === 0 && <option value="">Add a customer first</option>}
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={description}
            placeholder="Description"
            onChange={(e) => setDescription(e.target.value)}
            className="rounded-xl border-0 bg-slate-100 px-3 py-2 dark:bg-slate-800 dark:text-slate-100"
          />
          <input
            type="number"
            min={0}
            value={amountText}
            placeholder="Amount (₹)"
            onChange={(e) => setAmountText(e.target.value)}
            className="rounded-xl border-0 bg-slate-100 px-3 py-2 dark:bg-slate-800 dark:text-slate-100"
          />
          <input
            type="date"
            value={dueOn}
            onChange={(e) => setDueOn(e.target.value)}
            className="rounded-xl border-0 bg-slate-100 px-3 py-2 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
        <button
          type="submit"
          disabled={!canCreate}
          className="rounded-full bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition active:scale-[0.98] disabled:opacity-40"
        >
          Create invoice
        </button>
      </form>
    </div>
  );
}
