import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useStore } from '../store';
import { customerDebt } from '../lib/aging';
import { buildForecast, type ForecastParams } from '../lib/forecast';
import { formatINR } from '../lib/money';
import { reliabilityScore } from '../lib/reliability';
import { runScenario, type ScenarioId } from '../lib/scenarios';
import { toISODate, today } from '../lib/dates';
import type { Customer, Invoice } from '../lib/types';

const SCENARIO_IDS: ScenarioId[] = [
  'late-key-customer',
  'top-customer-churn',
  'rent-up-10',
  'two-new-clients',
];

const DEFAULT_ON_TIME = 0.7;

function onTimeMap(customers: Customer[], invoices: Invoice[], now: string): Record<string, number> {
  const map: Record<string, number> = {};
  for (const c of customers) {
    map[c.id] = reliabilityScore(invoices.filter((i) => i.customerId === c.id), now).score;
  }
  return map;
}

function formatDelta(n: number): string {
  if (n > 0) return `+${formatINR(n)}`;
  if (n < 0) return `−${formatINR(Math.abs(n))}`;
  return formatINR(0);
}

function shortDate(iso: string | null): string {
  return iso ? format(parseISO(iso), 'd MMM') : 'none';
}

function dipText(base: string | null, scenario: string | null): string {
  if (base === null && scenario === null) return 'none';
  if (base === scenario) return `${shortDate(base)} (no change)`;
  return `${shortDate(base)} → ${shortDate(scenario)}`;
}

export default function Forecast() {
  const customers = useStore((s) => s.customers);
  const invoices = useStore((s) => s.invoices);
  const bills = useStore((s) => s.bills);
  const settings = useStore((s) => s.settings);

  const [horizon, setHorizon] = useState<30 | 60 | 90>(30);

  const now = toISODate(today());
  const onTime = onTimeMap(customers, invoices, now);

  const baseParams: ForecastParams = {
    now,
    horizonDays: horizon,
    openingCash: settings.openingCash,
    safetyFloor: settings.safetyFloor,
    customers,
    invoices,
    bills,
    onTimeProbability: onTime,
  };

  const forecast = buildForecast(baseParams);

  const chartData = forecast.points.map((p) => ({
    date: p.date,
    balance: p.balance,
    bandLow: p.balance - p.lowConfidenceBand,
    bandSize: p.lowConfidenceBand * 2,
  }));

  // Key customer: lowest reliability among customers with invoices (fallback: first customer).
  let keyCustomerId = customers[0]?.id ?? '';
  let lowestScore = Number.POSITIVE_INFINITY;
  for (const c of customers) {
    if (!invoices.some((i) => i.customerId === c.id)) continue;
    const score = onTime[c.id] ?? DEFAULT_ON_TIME;
    if (score < lowestScore) {
      lowestScore = score;
      keyCustomerId = c.id;
    }
  }

  // Top customer: largest outstanding debt (fallback: first customer).
  let topCustomerId = customers[0]?.id ?? '';
  let topOwed = Number.NEGATIVE_INFINITY;
  for (const c of customers) {
    const owed = customerDebt(c, invoices, now).outstanding;
    if (owed > topOwed) {
      topOwed = owed;
      topCustomerId = c.id;
    }
  }

  const scenarios = SCENARIO_IDS.map((id) =>
    runScenario(id, baseParams, keyCustomerId, topCustomerId),
  );

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Forecast</h1>
        <div className="flex gap-1 rounded-full bg-slate-100 p-1 dark:bg-slate-800">
          {([30, 60, 90] as const).map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => setHorizon(h)}
              className={`rounded-full px-3 py-1 text-sm font-medium transition active:scale-[0.98] ${
                h === horizon ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-700 dark:text-slate-300'
              }`}
            >
              {h} days
            </button>
          ))}
        </div>
      </div>

      <section className="rounded-2xl bg-white p-5 shadow-sm dark:bg-slate-900">
        <div className="mb-3 flex flex-wrap gap-6 text-sm text-slate-700">
          <span>
            Lowest balance: <strong>{formatINR(forecast.minBalance)}</strong> on{' '}
            {shortDate(forecast.minBalanceDate)}
          </span>
          <span>
            Below safety floor ({formatINR(settings.safetyFloor)}):{' '}
            <strong>{shortDate(forecast.firstBelowFloorDate)}</strong>
          </span>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={chartData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="date"
              tickFormatter={(v: string) => format(parseISO(v), 'd MMM')}
              minTickGap={24}
            />
            <YAxis tickFormatter={(v: number) => formatINR(v)} width={90} />
            <Tooltip
              labelFormatter={(l) => format(parseISO(String(l)), 'd MMM yyyy')}
              formatter={(value) => formatINR(Number(value))}
            />
            {/* Shaded low-confidence band: transparent base plus a band-width stacked on top. */}
            <Area
              dataKey="bandLow"
              stackId="band"
              stroke="none"
              fill="transparent"
              isAnimationActive={false}
              legendType="none"
              tooltipType="none"
            />
            <Area
              dataKey="bandSize"
              stackId="band"
              stroke="none"
              fill="#94a3b8"
              fillOpacity={0.25}
              isAnimationActive={false}
              legendType="none"
              tooltipType="none"
            />
            <Area
              type="monotone"
              dataKey="balance"
              name="Balance"
              stroke="#0f172a"
              fill="#0f172a"
              fillOpacity={0.08}
              isAnimationActive={false}
            />
            <ReferenceLine
              y={settings.safetyFloor}
              stroke="#e11d48"
              strokeDasharray="4 4"
              label={{ value: 'Safety floor', position: 'insideTopRight', fill: '#e11d48', fontSize: 12 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">What if…</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {scenarios.map((s) => (
            <div key={s.id} className="rounded-2xl bg-white p-5 shadow-sm dark:bg-slate-900">
              <p className="font-medium text-slate-900 dark:text-slate-100">{s.label}</p>
              <p
                className={`mt-1 text-lg font-semibold ${
                  s.minBalanceDelta < 0 ? 'text-rose-600' : 'text-emerald-700'
                }`}
              >
                Low point {formatINR(s.scenario.lowFromTomorrow)} (change {formatDelta(s.minBalanceDelta)})
              </p>
              {s.id === 'late-key-customer' &&
                s.balanceOnKeyDueScenario !== null &&
                s.balanceOnKeyDueDelta !== null && (
                  <p
                    className={`mt-1 text-sm font-semibold ${
                      s.balanceOnKeyDueDelta < 0 ? 'text-rose-600' : 'text-emerald-700'
                    }`}
                  >
                    Balance on payment day ({shortDate(s.keyDueDate)}): {formatINR(s.balanceOnKeyDueScenario)}{' '}
                    (change {formatDelta(s.balanceOnKeyDueDelta)})
                  </p>
                )}
              <p className="mt-1 text-sm text-slate-500">
                Dip below floor: {dipText(s.dipDateBase, s.dipDateScenario)}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
