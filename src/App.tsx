import { useEffect, useRef, useState } from 'react';
import { Home, Users, FileText, LineChart, Receipt, type LucideIcon } from 'lucide-react';
import Dashboard from './components/Dashboard';
import Customers from './components/Customers';
import Invoices from './components/Invoices';
import Forecast from './components/Forecast';
import Bills from './components/Bills';
import { useStore } from './store';
import { buildSeed } from './seed';
import { toISODate, today } from './lib/dates';

type Tab = 'today' | 'customers' | 'invoices' | 'forecast' | 'bills';

const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: 'today', label: 'Today', icon: Home },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'invoices', label: 'Invoices', icon: FileText },
  { id: 'forecast', label: 'Forecast', icon: LineChart },
  { id: 'bills', label: 'Bills', icon: Receipt },
];

export default function App() {
  const [tab, setTab] = useState<Tab>('today');
  const seeded = useRef(false);
  const badDayMode = useStore((s) => s.badDayMode);
  const toggleBadDayMode = useStore((s) => s.toggleBadDayMode);
  const resetDemo = useStore((s) => s.resetDemo);

  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    if (useStore.getState().customers.length === 0) {
      const { customers, invoices, bills, settings } = buildSeed(toISODate(today()));
      useStore.setState({ customers, invoices, bills, settings });
    }
  }, []);

  const renderTab = () => {
    switch (tab) {
      case 'today':
        return <Dashboard onNavigate={setTab} />;
      case 'customers':
        return <Customers />;
      case 'invoices':
        return <Invoices />;
      case 'forecast':
        return <Forecast />;
      case 'bills':
        return <Bills />;
    }
  };

  const navButton = (t: (typeof TABS)[number], layout: 'top' | 'bottom') => {
    const active = tab === t.id;
    const Icon = t.icon;
    const base =
      layout === 'top'
        ? 'flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition active:scale-[0.97]'
        : 'flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition active:scale-[0.97]';
    const state = active
      ? 'text-brand-600 bg-brand-600/10 dark:text-brand-500'
      : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800';
    return (
      <button key={t.id} type="button" onClick={() => setTab(t.id)} aria-current={active ? 'page' : undefined} className={`${base} ${state}`}>
        <Icon className="h-5 w-5" aria-hidden="true" />
        <span>{t.label}</span>
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24 dark:bg-darkSurface md:pb-0">
      <header className="sticky top-0 z-10 border-b border-slate-200/70 bg-white/70 backdrop-blur-xl dark:border-slate-800 dark:bg-darkSurface/70">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 p-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-brand-700 dark:text-brand-500">ChairCash</h1>
            <p className="text-xs text-slate-500">Anjali's Studio</p>
          </div>
          <nav className="hidden gap-1 md:flex">{TABS.map((t) => navButton(t, 'top'))}</nav>
          <button
            type="button"
            onClick={toggleBadDayMode}
            aria-pressed={badDayMode}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition active:scale-[0.97] ${
              badDayMode
                ? 'border-amber-500 bg-amber-100 text-amber-800'
                : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300'
            }`}
          >
            Bad Day Mode {badDayMode ? 'on' : 'off'}
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Reset all data to the sample data?')) resetDemo();
            }}
            className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 active:scale-[0.97] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300"
          >
            Reset demo data
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl p-4">{renderTab()}</main>

      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-slate-200/70 bg-white/70 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden dark:border-slate-800 dark:bg-darkSurface/70">
        {TABS.map((t) => navButton(t, 'bottom'))}
      </nav>
    </div>
  );
}
