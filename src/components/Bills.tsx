import { useState, type FormEvent } from 'react';
import { useStore } from '../store';
import { toISODate, today } from '../lib/dates';
import { formatINR } from '../lib/money';
import type { Bill } from '../lib/types';

type Category = Bill['category'];

const CATEGORIES: Category[] = ['rent', 'salary', 'supplier', 'utility', 'other'];

export default function Bills() {
  const bills = useStore((s) => s.bills);
  const paidBillMonths = useStore((s) => s.paidBillMonths);
  const addBill = useStore((s) => s.addBill);
  const markBillPaid = useStore((s) => s.markBillPaid);

  const yyyyMm = toISODate(today()).slice(0, 7);

  const [name, setName] = useState('');
  const [amountText, setAmountText] = useState('');
  const [category, setCategory] = useState<Category>('other');
  const [recurring, setRecurring] = useState<Bill['recurring']>('monthly');
  const [dueDayText, setDueDayText] = useState('1');
  const [onceOn, setOnceOn] = useState(() => toISODate(today()));

  const amount = Number(amountText);
  const dueDay = Number(dueDayText);
  const dueDayValid = Number.isInteger(dueDay) && dueDay >= 1 && dueDay <= 31;
  const canAdd =
    name.trim() !== '' &&
    amount > 0 &&
    (recurring === 'monthly' ? dueDayValid : onceOn !== '');

  const handleAdd = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    if (!canAdd) return;
    if (recurring === 'monthly') {
      addBill({
        name: name.trim(),
        amount,
        category,
        recurring: 'monthly',
        dueDay,
      });
    } else {
      addBill({
        name: name.trim(),
        amount,
        category,
        recurring: 'once',
        dueDay: Number(onceOn.slice(8, 10)),
        onceOn,
      });
    }
    setName('');
    setAmountText('');
  };

  return (
    <div className="space-y-6 p-4">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Bills</h1>

      <ul className="divide-y divide-slate-200 overflow-hidden rounded-2xl bg-white shadow-sm dark:divide-slate-700 dark:bg-slate-900">
        {bills.length === 0 && <li className="px-4 py-3 text-sm text-slate-500">No bills yet.</li>}
        {bills.map((b) => {
          const paid = paidBillMonths[`${b.id}:${yyyyMm}`] === true;
          const when = b.recurring === 'monthly' ? `Monthly, day ${b.dueDay}` : `Once on ${b.onceOn ?? ''}`;
          return (
            <li key={b.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1">
                <p className="font-medium text-slate-900 dark:text-slate-100">{b.name}</p>
                <p className="text-sm text-slate-500 capitalize">
                  {b.category} · {when}
                </p>
              </div>
              <span className="text-sm text-slate-700">{formatINR(b.amount)}</span>
              {paid ? (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                  Paid this month
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => markBillPaid(b.id, yyyyMm)}
                  className="rounded-full bg-brand-600 px-4 py-1.5 text-sm font-medium text-white transition active:scale-[0.98]"
                >
                  Mark paid
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <form onSubmit={handleAdd} className="space-y-3 rounded-2xl bg-white p-5 shadow-sm dark:bg-slate-900">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Add bill</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input
            type="text"
            value={name}
            placeholder="Name (e.g. Shop rent)"
            onChange={(e) => setName(e.target.value)}
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
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
            className="rounded-xl border-0 bg-slate-100 px-3 py-2 capitalize dark:bg-slate-800 dark:text-slate-100"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={recurring}
            onChange={(e) => setRecurring(e.target.value as Bill['recurring'])}
            className="rounded-xl border-0 bg-slate-100 px-3 py-2 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value="monthly">Recurring monthly</option>
            <option value="once">One-time</option>
          </select>
          {recurring === 'monthly' ? (
            <input
              type="number"
              min={1}
              max={31}
              value={dueDayText}
              placeholder="Due day of month (1-31)"
              onChange={(e) => setDueDayText(e.target.value)}
              className="rounded-xl border-0 bg-slate-100 px-3 py-2 dark:bg-slate-800 dark:text-slate-100"
            />
          ) : (
            <input
              type="date"
              value={onceOn}
              onChange={(e) => setOnceOn(e.target.value)}
              className="rounded-xl border-0 bg-slate-100 px-3 py-2 dark:bg-slate-800 dark:text-slate-100"
            />
          )}
        </div>
        <button
          type="submit"
          disabled={!canAdd}
          className="rounded-full bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition active:scale-[0.98] disabled:opacity-40"
        >
          Add bill
        </button>
      </form>
    </div>
  );
}
