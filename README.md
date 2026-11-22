# ChairCash — a one-person back office for small businesses

Hackathon: **CODEBENDERS, ACE BUILDERS' HACKATHON 2026**
Problem Statement 1 | Small Business Operations: **The One-Person Back Office**

Micro-businesses such as salons, freelancers, shopkeepers, tutors and small clinics
run on WhatsApp chats, notebooks and spreadsheets. ChairCash keeps invoices, payments
and cash planning in one place, so the owner can see who owes what and whether next
month's rent, salaries and supplier bills are covered.

## What it does

- **Invoice → payment → reminder flow.** Create an invoice, record part or full
  payments, and send a WhatsApp reminder in one of three tones via a `wa.me` link.
- **"Who owes me" dashboard.** Outstanding balances grouped into aging buckets
  (0–7, 8–30, 31–60, 60+ days).
- **30–90 day cash forecast.** Projected cash with a safety floor and a
  low-confidence band that widens the further out the forecast looks.
- **What-if scenarios (four):**
  1. A late payment from a key customer.
  2. Churn of the top customer.
  3. A 10% rent increase.
  4. Two new clients signing up.
- **Alerts with a next action.** Each alert says what is wrong and what to do next.
- **Bad Day Mode.** A simplified view that focuses on what to collect and what to
  defer when cash is tight.
- **Quick-add.** Type a line such as `Meera 2 haircut 800 due 15 days` to create
  the customer, the invoice and its due date in one step.

## Tech stack

- React 18, TypeScript (strict), Vite
- Tailwind CSS
- zustand with localStorage persistence
- recharts for charts
- date-fns for date logic
- vitest for tests

## Getting started

```bash
cd chaircash
npm install
npm run dev      # start the dev server
npm test         # run vitest
npm run build    # type-check and production build
```

## Project layout

```
chaircash/
├── src/
│   ├── lib/          pure logic (invoice status, aging, reliability score,
│   │                 reminders, quick-add parser, forecast, scenarios, alerts)
│   │                 and their *.test.ts files
│   ├── components/   screens: dashboard, customers, invoices, reminders,
│   │                 forecast, bills, quick-add
│   ├── store.ts      zustand store with localStorage persistence
│   ├── seed.ts       sample data for "Anjali's Studio"
│   └── App.tsx       navigation, Bad Day Mode and alerts
├── README.md
└── package.json
```

## Notes

- All data is stored in the browser's localStorage under the key `chaircash-v2`.
- There is no backend; nothing leaves the device.
- Sample data (Anjali's Studio) loads on first run so the screens are not empty.
  Clearing the `chaircash-v2` key resets the app to that state on the next load.

## 3-minute demo script (bad day)

Setup: fresh load so the sample data for Anjali's Studio is on screen. To get there
quickly, click the "Reset demo data" button in the header.

1. **Open Today (0:00–0:30).** The cash-weather card shows the probability that
   cash drops below the safety floor, computed from the 5,000-run Monte Carlo
   simulation. Say the number out loud.

2. **Point out the worst-case date (0:30–1:00).** Read the Worst-case date on the
   same card. This is the day the owner most needs to act by, not a guess.

3. **Turn on Bad Day Mode (1:00–1:45).** Switch it on, and note that five customers
   are now late. Show the Bad day plan: a ranked list of who to collect from first
   and what to defer. Read the summary sentence at the top of the plan.

4. **Send one reminder (1:45–2:15).** Tap one WhatsApp button. The drafted reminder
   opens in `wa.me` with the tone matched to how late that customer is. Point out
   that the owner only approves and sends.

5. **Run the late-key-customer scenario (2:15–2:45).** Open the Forecast tab and
   run the scenario where Shubh Weddings (bridal party) pays 15 days late. Show the dip date
   moving later or earlier on the chart and compare it with the Worst-case date
   from step 2.

6. **Close (2:45–3:00).** Say the pitch line:
   > "The owner enters nothing new, approves a plan, and the cash number is a
   > probability, not a guess."

**Who pays.** A flat monthly fee per salon, set against the late-payment money
ChairCash recovers: invoices collected earlier, and reminders that actually get
sent. If recovered cash is more than the fee, the salon pays for itself.

