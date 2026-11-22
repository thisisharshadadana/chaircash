import { useState, type FormEvent } from 'react';
import { useStore } from '../store';
import { customerDebt } from '../lib/aging';
import { formatINR } from '../lib/money';
import { reliabilityScore, type ReliabilityLabel } from '../lib/reliability';
import { toISODate, today } from '../lib/dates';

const LABEL_CLASS: Record<ReliabilityLabel, string> = {
  Reliable: 'bg-emerald-100 text-emerald-800',
  'Usually on time': 'bg-sky-100 text-sky-800',
  'Often late': 'bg-rose-100 text-rose-800',
  New: 'bg-slate-100 text-slate-700',
};

export default function Customers() {
  const customers = useStore((s) => s.customers);
  const invoices = useStore((s) => s.invoices);
  const addCustomer = useStore((s) => s.addCustomer);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const now = toISODate(today());
  const canAdd = name.trim() !== '';

  const handleAdd = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    if (!canAdd) return;
    addCustomer({ name: name.trim(), phone: phone.trim() });
    setName('');
    setPhone('');
  };

  return (
    <div className="space-y-6 p-4">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Customers</h1>

      <ul className="divide-y divide-slate-200 overflow-hidden rounded-2xl bg-white shadow-sm dark:divide-slate-700 dark:bg-slate-900">
        {customers.length === 0 && (
          <li className="px-4 py-3 text-sm text-slate-500">No customers yet.</li>
        )}
        {customers.map((c) => {
          const customerInvoices = invoices.filter((i) => i.customerId === c.id);
          const { label } = reliabilityScore(customerInvoices, now);
          const { outstanding: owed } = customerDebt(c, invoices, now);
          return (
            <li key={c.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1">
                <p className="font-medium text-slate-900 dark:text-slate-100">{c.name}</p>
                <p className="text-sm text-slate-500">{c.phone || 'No phone'}</p>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${LABEL_CLASS[label]}`}>
                {label === 'New' ? 'Not enough history yet' : label}
              </span>
              <span className="w-28 text-right text-sm text-slate-700">
                {owed > 0 ? `Owes ${formatINR(owed)}` : 'Nothing owed'}
              </span>
            </li>
          );
        })}
      </ul>

      <form onSubmit={handleAdd} className="space-y-3 rounded-2xl bg-white p-5 shadow-sm dark:bg-slate-900">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Add customer</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input
            type="text"
            value={name}
            placeholder="Name"
            onChange={(e) => setName(e.target.value)}
            className="rounded-xl border-0 bg-slate-100 px-3 py-2 dark:bg-slate-800 dark:text-slate-100"
          />
          <input
            type="tel"
            value={phone}
            placeholder="Phone (for WhatsApp)"
            onChange={(e) => setPhone(e.target.value)}
            className="rounded-xl border-0 bg-slate-100 px-3 py-2 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
        <button
          type="submit"
          disabled={!canAdd}
          className="rounded-full bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition active:scale-[0.98] disabled:opacity-40"
        >
          Add customer
        </button>
      </form>
    </div>
  );
}
