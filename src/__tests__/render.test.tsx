import './setupStorage';

import { describe, it, expect, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import React from 'react';
import Dashboard from '../components/Dashboard';
import Customers from '../components/Customers';
import Invoices from '../components/Invoices';
import Bills from '../components/Bills';
import Forecast from '../components/Forecast';
import App from '../App';
import { useStore } from '../store';
import { buildSeed } from '../seed';
import { toISODate, today } from '../lib/dates';

beforeEach(() => {
  localStorage.clear();
  const seed = buildSeed(toISODate(today()));
  useStore.setState({
    customers: seed.customers,
    invoices: seed.invoices,
    bills: seed.bills,
    settings: seed.settings,
  });
});

function renderHtml(element: React.ReactElement): string {
  const html = renderToString(element);
  expect(typeof html).toBe('string');
  expect(html.length).toBeGreaterThan(0);
  expect(html).not.toContain('Something went wrong');
  return html;
}

describe('screen render smoke test', () => {
  it('renders Dashboard without crashing', () => {
    renderHtml(React.createElement(Dashboard, { onNavigate: () => {} }));
  });

  it('renders Customers without crashing', () => {
    renderHtml(React.createElement(Customers));
  });

  it('renders Invoices without crashing', () => {
    renderHtml(React.createElement(Invoices));
  });

  it('renders Bills without crashing', () => {
    renderHtml(React.createElement(Bills));
  });

  it('renders Forecast without crashing', () => {
    renderHtml(React.createElement(Forecast));
  });

  it('renders App without crashing', () => {
    renderHtml(React.createElement(App));
  });

  it('Dashboard shows real content (Bad day plan heading)', () => {
    const html = renderHtml(React.createElement(Dashboard, { onNavigate: () => {} }));
    expect(html).toContain('Bad day plan');
  });
});
