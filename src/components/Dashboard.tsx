import { useMemo, useState } from 'react';
import { Cloud, CloudLightning, MessageCircle, Sun, X, type LucideIcon } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useStore } from '../store';
import { buildAlerts, type Alert } from '../lib/alerts';
import { bucketFor, customerDebt, daysOverdue, type Bucket } from '../lib/aging';
import { buildForecast } from '../lib/forecast';
import { simulateCash } from '../lib/monteCarlo';
import { buildAutopilot } from '../lib/autopilot';
import { buildDecisionOptions } from '../lib/decisions';
import { parsePasted, type PastedEntry } from '../lib/pasteBook';
import { formatINR, outstanding } from '../lib/money';
import { parseQuickAdd } from '../lib/parseQuickAdd';
import { reliabilityScore } from '../lib/reliability';
import { draftReminder, whatsappLink, type Tone } from '../lib/reminders';
import { toISODate, today } from '../lib/dates';
import type { Customer, Invoice } from '../lib/types';

/** Business name used in reminder text; no settings field exists for it yet. */
const BUSINESS_NAME = 'ChairCash';

const BUCKETS: Bucket[] = ['0-7', '8-30', '31-60', '60+'];

type Group = 'current' | Bucket;
const GROUPS: Group[] = ['current', '0-7', '8-30', '31-60', '60+'];
const GROUP_LABEL: Record<Group, string> = {
  current: 'Not yet due',
  '0-7': '1–7 days overdue',
  '8-30': '8–30 days overdue',
  '31-60': '31–60 days overdue',
  '60+': 'Over 60 days overdue',
};

type Weather = 'sunny' | 'cloudy' | 'stormy';
const WEATHER: Record<Weather, { label: string; Icon: LucideIcon; className: string }> = {
  sunny: { label: 'Sunny', Icon: Sun, className: 'text-amber-500' },
  cloudy: { label: 'Cloudy', Icon: Cloud, className: 'text-slate-500 dark:text-slate-400' },
  stormy: { label: 'Stormy', Icon: CloudLightning, className: 'text-rose-600' },
};

export interface DashboardProps {
  onNavigate: (tab: 'today' | 'customers' | 'invoices' | 'forecast' | 'bills') => void;
}

function toneFor(days: number): Tone {
  if (days <= 7) return 'friendly';
  if (days <= 30) return 'firm';
  return 'final';
}

function onTimeMap(customers: Customer[], invoices: Invoice[], now: string): Record<string, number> {
  const map: Record<string, number> = {};
  for (const c of customers) {
    map[c.id] = reliabilityScore(invoices.filter((i) => i.customerId === c.id), now).score;
  }
  return map;
}

interface AlertCardProps {
  alert: Alert;
  onAction: () => void;
  onDismiss: () => void;
}

function AlertCard({ alert, onAction, onDismiss }: AlertCardProps) {
  return (
    <div className="flex items-start gap-3 rounded-3xl border border-slate-200/60 bg-white shadow-soft dark:border-slate-800 dark:bg-slate-900 p-3">
      <div className="flex-1">
        <p className="font-medium text-slate-900 dark:text-slate-100">{alert.title}</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">{alert.reason}</p>
      </div>
      <button
        type="button"
        onClick={onAction}
        className="flex items-center gap-1 rounded-full bg-brand-600 px-3 py-1.5 text-sm font-medium text-white transition active:scale-[0.98]"
      >
        {alert.kind === 'chase' && <MessageCircle className="h-4 w-4" />}
        {alert.actionLabel}
      </button>
      <button
        type="button"
        aria-label="Dismiss alert"
        onClick={onDismiss}
        className="rounded-full p-1 text-slate-400 transition hover:text-slate-700 dark:text-slate-300 active:scale-[0.9]"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  const customers = useStore((s) => s.customers);
  const invoices = useStore((s) => s.invoices);
  const bills = useStore((s) => s.bills);
  const settings = useStore((s) => s.settings);
  const dismissedAlertIds = useStore((s) => s.dismissedAlertIds);
  const badDayMode = useStore((s) => s.badDayMode);
  const paidBillMonths = useStore((s) => s.paidBillMonths);
  const toggleBadDayMode = useStore((s) => s.toggleBadDayMode);
  const quickAdd = useStore((s) => s.quickAdd);
  const dismissAlert = useStore((s) => s.dismissAlert);
  const markBillPaid = useStore((s) => s.markBillPaid);
  const addReminder = useStore((s) => s.addReminder);
  const addCustomer = useStore((s) => s.addCustomer);
  const recordPayment = useStore((s) => s.recordPayment);

  const [text, setText] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [pasted, setPasted] = useState<PastedEntry[] | null>(null);
  const [pasteNotes, setPasteNotes] = useState<Record<number, string>>({});

  const now = toISODate(today());
  const yyyyMm = now.slice(0, 7);

  // Cash weather: 30-day forecast.
  const forecast = buildForecast({
    now,
    horizonDays: 30,
    openingCash: settings.openingCash,
    safetyFloor: settings.safetyFloor,
    customers,
    invoices,
    bills,
    onTimeProbability: onTimeMap(customers, invoices, now),
  });
  const weather: Weather =
    forecast.minBalance >= settings.safetyFloor * 1.5
      ? 'sunny'
      : forecast.minBalance >= settings.safetyFloor
        ? 'cloudy'
        : 'stormy';
  const { label: weatherLabel, Icon: WeatherIcon, className: weatherClass } = WEATHER[weather];

  // Monte Carlo cash simulation and the Bad Day collection plan.
  const sim = useMemo(
    () =>
      simulateCash({
        now,
        horizonDays: 30,
        openingCash: settings.openingCash,
        safetyFloor: settings.safetyFloor,
        customers,
        invoices,
        bills,
        onTimeProbability: onTimeMap(customers, invoices, now),
      }),
    [now, settings.openingCash, settings.safetyFloor, customers, invoices, bills],
  );
  const autopilot = useMemo(
    () =>
      buildAutopilot({
        now,
        invoices,
        customers,
        lowestBalance: forecast.minBalance,
        safetyFloor: settings.safetyFloor,
      }),
    [now, invoices, customers, forecast.minBalance, settings.safetyFloor],
  );

  // Costed what-if options, using the top debtor by outstanding amount.
  const decisions = useMemo(() => {
    let topOwingCustomerId: string | null = null;
    let topOwed = 0;
    for (const c of customers) {
      const owed = customerDebt(c, invoices, now).outstanding;
      if (owed > topOwed) {
        topOwed = owed;
        topOwingCustomerId = c.id;
      }
    }
    return buildDecisionOptions({
      now,
      horizonDays: 30,
      openingCash: settings.openingCash,
      safetyFloor: settings.safetyFloor,
      customers,
      invoices,
      bills,
      onTimeProbability: onTimeMap(customers, invoices, now),
      topOwingCustomerId,
    });
  }, [now, settings.openingCash, settings.safetyFloor, customers, invoices, bills]);

  // Alerts, with bills already paid this month removed.
  const alerts = buildAlerts({
    now,
    invoices,
    customers,
    forecast,
    bills,
    dismissedIds: dismissedAlertIds,
  }).filter((a) => {
    if (a.kind !== 'bill-due' || a.targetBillId === undefined) return true;
    return !paidBillMonths[`${a.targetBillId}:${yyyyMm}`];
  });

  // Quick-add preview.
  const draft = text.trim() === '' ? null : parseQuickAdd(text);
  const canConfirm = draft !== null && draft.customerName !== '' && draft.amount > 0;

  const confirmQuickAdd = (): void => {
    if (!draft || !canConfirm) return;
    quickAdd(draft);
    setText('');
  };

  const readPaste = (): void => {
    setPasted(parsePasted(pasteText));
    setPasteNotes({});
  };

  const addPastedPayment = (index: number, entry: PastedEntry): void => {
    const wanted = entry.customerName.trim().toLowerCase();
    const existing = customers.find((c) => c.name.trim().toLowerCase() === wanted);
    const customerId = existing
      ? existing.id
      : addCustomer({ name: entry.customerName.trim(), phone: '' });
    const open = invoices
      .filter((i) => i.customerId === customerId && i.sent && outstanding(i) > 0)
      .sort((a, b) => a.dueOn.localeCompare(b.dueOn))[0];
    if (!open) {
      setPasteNotes((prev) => ({ ...prev, [index]: 'No open invoice for this customer' }));
      return;
    }
    recordPayment(
      open.id,
      Math.min(entry.amount, outstanding(open)),
      entry.date ?? toISODate(today()),
    );
    setPasteNotes((prev) => ({ ...prev, [index]: 'Added' }));
  };

  const sendReminder = (inv: Invoice): void => {
    const customer = customers.find((c) => c.id === inv.customerId);
    if (!customer) return;
    const days = daysOverdue(inv, now);
    const tone = toneFor(days);
    const message = draftReminder({
      customerName: customer.name,
      amount: outstanding(inv),
      dueOn: inv.dueOn,
      tone,
      businessName: BUSINESS_NAME,
      daysOverdue: days,
    });
    addReminder(inv.id, tone);
    window.open(whatsappLink(customer.phone, message), '_blank');
  };

  const runAlert = (a: Alert): void => {
    if (a.kind === 'chase') {
      const inv = invoices.find((i) => i.id === a.targetInvoiceId);
      if (inv) sendReminder(inv);
    } else if (a.kind === 'cash-dip') {
      onNavigate('forecast');
    } else if (a.kind === 'bill-due' && a.targetBillId !== undefined) {
      markBillPaid(a.targetBillId, yyyyMm);
    }
  };

  const header = (
    <div className="flex items-center justify-between">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Dashboard</h1>
      <button
        type="button"
        aria-pressed={badDayMode}
        onClick={toggleBadDayMode}
        className={
          badDayMode
            ? 'rounded-full bg-rose-600 px-3 py-1.5 text-sm font-medium text-white transition active:scale-[0.98]'
            : 'rounded-full border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 transition active:scale-[0.98] dark:border-slate-600'
        }
      >
        {badDayMode ? 'Bad Day Mode: on' : 'Bad Day Mode'}
      </button>
    </div>
  );

  if (badDayMode) {
    const chase = alerts.filter((a) => a.kind === 'chase');
    return (
      <div className="space-y-6 p-4">
        {header}
        <section className="space-y-2">
          <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">Chase these today</h2>
          {chase.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">Nothing to chase today.</p>}
          {chase.map((a) => (
            <AlertCard
              key={a.id}
              alert={a}
              onAction={() => runAlert(a)}
              onDismiss={() => dismissAlert(a.id)}
            />
          ))}
        </section>
      </div>
    );
  }

  // Who owes me: totals from customerDebt, rows are open sent invoices.
  const debts = customers.map((c) => customerDebt(c, invoices, now));
  const totals: Record<Bucket, number> = { '0-7': 0, '8-30': 0, '31-60': 0, '60+': 0 };
  for (const d of debts) {
    for (const b of BUCKETS) totals[b] += d.buckets[b];
  }
  const openInvoices = invoices
    .filter((i) => i.sent && outstanding(i) > 0)
    .sort((a, b) => a.dueOn.localeCompare(b.dueOn));
  const groupOf = (inv: Invoice): Group => bucketFor(daysOverdue(inv, now)) ?? 'current';
  const nameOf = (customerId: string): string =>
    customers.find((c) => c.id === customerId)?.name ?? 'Customer';

  return (
    <div className="space-y-6 p-4">
      {header}

      {/* (0) Monte Carlo risk and Bad Day plan */}
      <section className="space-y-3 rounded-3xl border border-slate-200/60 bg-white shadow-soft dark:border-slate-800 dark:bg-slate-900 p-4">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">Cash risk (next 30 days)</p>
          <p className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {`${Math.round(sim.probBelowFloor * 100)}% chance cash drops below your ${formatINR(settings.safetyFloor)} floor in the next 30 days`}
          </p>
          {sim.worstDate !== null && (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {`Worst case around ${format(parseISO(sim.worstDate), 'd MMM')}`}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">Bad day plan</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">{autopilot.summary}</p>
          {autopilot.steps.length === 0 && (
            <p className="text-sm text-slate-500 dark:text-slate-400">No overdue invoices to chase.</p>
          )}
          {autopilot.steps.map((s) => (
            <div key={s.invoiceId} className="flex items-center gap-3 text-sm">
              <span className="w-6 text-slate-400">{`${s.rank}.`}</span>
              <span className="flex-1 text-slate-900 dark:text-slate-100">{s.customerName}</span>
              <span className="text-slate-700 dark:text-slate-300">{formatINR(s.amount)}</span>
              <span className="w-40 text-right text-slate-500 dark:text-slate-400">
                {`${s.tone} · ${s.daysOverdue} days overdue`}
              </span>
              <button
                type="button"
                onClick={() => window.open(s.whatsappUrl, '_blank')}
                className="flex items-center gap-1 rounded-full border border-slate-300 px-3 py-1 text-slate-700 dark:text-slate-300 transition active:scale-[0.98] dark:border-slate-600"
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* (a) Cash weather */}
      <section className="flex items-center gap-4 rounded-3xl border border-slate-200/60 bg-white shadow-soft dark:border-slate-800 dark:bg-slate-900 p-4">
        <WeatherIcon className={`h-10 w-10 ${weatherClass}`} />
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">Cash weather (next 30 days)</p>
          <p className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {weatherLabel} · low point {formatINR(forecast.minBalance)}
          </p>
        </div>
      </section>

      {/* (b) Quick add */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">Quick add</h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={text}
            placeholder="Meera 2 haircut 800 due 15 days"
            onChange={(e) => setText(e.target.value)}
            className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 transition focus:outline-none focus:ring-2 focus:ring-brand-500/40 dark:border-slate-600 dark:bg-slate-900"
          />
          <button
            type="button"
            disabled={!canConfirm}
            onClick={confirmQuickAdd}
            className="rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition active:scale-[0.98] disabled:opacity-40"
          >
            Confirm
          </button>
        </div>
        {draft && (
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {`${draft.customerName} — ${draft.quantity} × ${draft.description} — ${formatINR(draft.amount)} — due in ${draft.dueDays} days`}
          </p>
        )}
      </section>

      {/* (c) Morning brief */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">Morning brief</h2>
        {alerts.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">Nothing needs you right now.</p>}
        {alerts.slice(0, 3).map((a) => (
          <AlertCard
            key={a.id}
            alert={a}
            onAction={() => runAlert(a)}
            onDismiss={() => dismissAlert(a.id)}
          />
        ))}
      </section>

      {/* (d) Who owes me */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">Who owes me</h2>
        {GROUPS.map((g) => {
          const rows = openInvoices.filter((i) => groupOf(i) === g);
          const groupTotal =
            g === 'current'
              ? rows.reduce((sum, i) => sum + outstanding(i), 0)
              : totals[g];
          return (
            <div key={g} className="rounded-3xl border border-slate-200/60 bg-white shadow-soft dark:border-slate-800 dark:bg-slate-900">
              <div className="flex justify-between border-b border-slate-200 px-3 py-2 dark:border-slate-800">
                <span className="font-medium text-slate-800">{GROUP_LABEL[g]}</span>
                <span className="text-slate-700 dark:text-slate-300">{formatINR(groupTotal)}</span>
              </div>
              {rows.length === 0 && <p className="px-3 py-2 text-sm text-slate-400">None</p>}
              {rows.map((inv) => {
                const days = daysOverdue(inv, now);
                return (
                  <div key={inv.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <span className="flex-1 text-slate-900 dark:text-slate-100">{nameOf(inv.customerId)}</span>
                    <span className="text-slate-700 dark:text-slate-300">{formatINR(outstanding(inv))}</span>
                    <span className="w-28 text-right text-slate-500 dark:text-slate-400">
                      {days > 0 ? `${days} days overdue` : `due ${inv.dueOn}`}
                    </span>
                    <button
                      type="button"
                      onClick={() => sendReminder(inv)}
                      className="flex items-center gap-1 rounded-full border border-slate-300 px-3 py-1 text-slate-700 dark:text-slate-300 transition active:scale-[0.98] dark:border-slate-600"
                    >
                      <MessageCircle className="h-4 w-4" />
                      Remind
                    </button>
                  </div>
                );
              })}
            </div>
          );
        })}
      </section>

      {/* (e) Paste to book */}
      <section className="space-y-3 rounded-3xl border border-slate-200/60 bg-white shadow-soft dark:border-slate-800 dark:bg-slate-900 p-4">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">Paste to book</h2>
        <textarea
          value={pasteText}
          placeholder="Paste a WhatsApp chat or bank SMS"
          onChange={(e) => setPasteText(e.target.value)}
          rows={4}
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 transition focus:outline-none focus:ring-2 focus:ring-brand-500/40 dark:border-slate-600 dark:bg-slate-900 text-sm"
        />
        <button
          type="button"
          disabled={pasteText.trim() === ''}
          onClick={readPaste}
          className="rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition active:scale-[0.98] disabled:opacity-40"
        >
          Read it
        </button>
        {pasted !== null && pasted.length === 0 && (
          <p className="text-sm text-slate-500 dark:text-slate-400">Nothing recognised in that text.</p>
        )}
        {pasted !== null &&
          pasted.map((entry, i) => (
            <div key={`${i}-${entry.sourceLine}`} className="space-y-1 rounded-2xl border border-slate-200/60 p-3 text-sm dark:border-slate-800">
              <div className="flex items-center gap-3">
                <span className="flex-1 text-slate-900 dark:text-slate-100">{entry.customerName}</span>
                <span className="text-slate-700 dark:text-slate-300">{formatINR(entry.amount)}</span>
                <span className="capitalize text-slate-500 dark:text-slate-400">{entry.kind}</span>
                <span className="text-slate-500 dark:text-slate-400">{entry.date ?? 'no date'}</span>
                <button
                  type="button"
                  disabled={pasteNotes[i] === 'Added'}
                  onClick={() => addPastedPayment(i, entry)}
                  className="rounded-full border border-slate-300 px-3 py-1 text-slate-700 dark:text-slate-300 transition active:scale-[0.98] dark:border-slate-600 disabled:opacity-40"
                >
                  Add as payment
                </button>
              </div>
              {pasteNotes[i] !== undefined && (
                <p className="text-sm text-slate-600 dark:text-slate-400">{pasteNotes[i]}</p>
              )}
            </div>
          ))}
      </section>

      {/* (f) What should I do? */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">What should I do?</h2>
        {decisions.map((o) => (
          <div key={o.id} className="space-y-1 rounded-3xl border border-slate-200/60 bg-white shadow-soft dark:border-slate-800 dark:bg-slate-900 p-3">
            <div className="flex items-center gap-3">
              <p className="flex-1 font-medium text-slate-900 dark:text-slate-100">{o.label}</p>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  o.clearsFloor ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}
              >
                {o.clearsFloor ? 'Clears floor' : 'Misses floor'}
              </span>
            </div>
            <p className="text-sm text-slate-700 dark:text-slate-300">
              {`Cost ${formatINR(o.cost)} · cash gain ${formatINR(o.cashGain)} · low point after ${formatINR(o.minBalanceAfter)}`}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">{o.explanation}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
