import { buildForecast, expectedReceiptDate, type ForecastResult } from './forecast';
import { outstanding } from './money';
import type { Invoice } from './types';

export type ScenarioId = 'late-key-customer' | 'top-customer-churn' | 'rent-up-10' | 'two-new-clients';

export interface ScenarioResult {
  id: ScenarioId;
  label: string;
  baseline: ForecastResult;
  scenario: ForecastResult;
  /** scenario.lowFromTomorrow − baseline.lowFromTomorrow */
  minBalanceDelta: number;
  dipDateBase: string | null;
  dipDateScenario: string | null;
  /** key customer's largest sent unpaid invoice's baseline expected payment date, or null */
  keyDueDate: string | null;
  /** baseline balance on keyDueDate (nearest point on/after it), or null */
  balanceOnKeyDueBase: number | null;
  /** scenario balance on keyDueDate (nearest point on/after it), or null */
  balanceOnKeyDueScenario: number | null;
  /** balanceOnKeyDueScenario − balanceOnKeyDueBase, or null */
  balanceOnKeyDueDelta: number | null;
}

/** Balance at the first forecast point on or after `date`, or null if none. */
function balanceOnOrAfter(forecast: ForecastResult, date: string): number | null {
  const point = forecast.points.find((p) => p.date >= date);
  return point ? point.balance : null;
}

type BaseParams = Parameters<typeof buildForecast>[0];

const LABELS: Record<ScenarioId, string> = {
  'late-key-customer': 'Your key customer pays 15 days late',
  'top-customer-churn': 'Your top customer stops paying',
  'rent-up-10': 'Rent goes up by 10%',
  'two-new-clients': 'Two new clients add ₹3,000 a month each',
};

/** Returns forecast overrides for a scenario, merged additively with the base inputs. */
function overridesFor(
  id: ScenarioId,
  base: BaseParams,
  keyCustomerId: string,
  topCustomerId: string,
): Partial<BaseParams> {
  switch (id) {
    case 'late-key-customer':
      return {
        delayDaysByCustomer: { ...base.delayDaysByCustomer, [keyCustomerId]: 15 },
      };
    case 'top-customer-churn':
      return {
        excludeCustomerIds: [...(base.excludeCustomerIds ?? []), topCustomerId],
      };
    case 'rent-up-10':
      return { rentIncreasePct: 10 };
    case 'two-new-clients':
      return {
        extraMonthlyInflows: [
          ...(base.extraMonthlyInflows ?? []),
          { amount: 3000, startDay: 0 },
          { amount: 3000, startDay: 0 },
        ],
      };
  }
}

export function runScenario(
  id: ScenarioId,
  base: BaseParams,
  keyCustomerId: string,
  topCustomerId: string,
): ScenarioResult {
  const baseline = buildForecast(base);
  const scenario = buildForecast({
    ...base,
    ...overridesFor(id, base, keyCustomerId, topCustomerId),
  });

  // Key customer's largest sent, unpaid invoice, expected on its baseline (undelayed) date.
  const keyInvoice = base.invoices
    .filter((inv) => inv.customerId === keyCustomerId && inv.sent && outstanding(inv) > 0)
    .reduce<Invoice | undefined>(
      (best, inv) => (best === undefined || outstanding(inv) > outstanding(best) ? inv : best),
      undefined,
    );
  const keyDueDate = keyInvoice
    ? expectedReceiptDate(
        keyInvoice,
        base.customers,
        base.invoices,
        base.now,
        0,
        base.expectedOverride?.[keyInvoice.id],
      )
    : null;

  const balanceOnKeyDueBase = keyDueDate !== null ? balanceOnOrAfter(baseline, keyDueDate) : null;
  const balanceOnKeyDueScenario = keyDueDate !== null ? balanceOnOrAfter(scenario, keyDueDate) : null;
  const balanceOnKeyDueDelta =
    balanceOnKeyDueBase !== null && balanceOnKeyDueScenario !== null
      ? balanceOnKeyDueScenario - balanceOnKeyDueBase
      : null;

  return {
    id,
    label: LABELS[id],
    baseline,
    scenario,
    minBalanceDelta: scenario.lowFromTomorrow - baseline.lowFromTomorrow,
    dipDateBase: baseline.dipFromTomorrowDate,
    dipDateScenario: scenario.dipFromTomorrowDate,
    keyDueDate,
    balanceOnKeyDueBase,
    balanceOnKeyDueScenario,
    balanceOnKeyDueDelta,
  };
}
