export interface PastedEntry {
  kind: 'invoice' | 'payment';
  customerName: string;
  amount: number;
  description: string;
  /** ISO yyyy-mm-dd, or null when the line has no dd/mm/yy(yy) date */
  date: string | null;
  sourceLine: string;
}

/** dd/mm/yy or dd/mm/yyyy */
const DATE_RE = /\b(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})\b/;
const DATE_G = new RegExp(DATE_RE.source, 'g');
/** WhatsApp export: "[12/03/26, 10:14] Meera: text" or "12/03/26, 10:14 - Meera: text" */
const WA_RE = /^\s*\[?\d{1,2}\/\d{1,2}\/\d{2,4},?\s+\d{1,2}:\d{2}(?::\d{2})?\]?\s*-?\s*([^:]+):\s*(.*)$/;

const NUM = '(\\d[\\d,]*(?:\\.\\d{1,2})?)';
const CUR_RE = new RegExp(`(?:₹|Rs\\.?|INR)\\s*${NUM}`, 'i');
const KW_BEFORE_RE = new RegExp(`(?:paid|received|credited)\\s+${NUM}`, 'i');
const KW_AFTER_RE = new RegExp(`${NUM}\\s+(?:paid|received|credited|transferred)`, 'i');
const ANY_NUM_RE = new RegExp(NUM);
const PAY_RE = /paid|payment|transferred|credited|received/i;
const INV_RE = /invoice|bill|due/i;

function toISO(d: string, m: string, y: string): string | null {
  const day = Number(d);
  const month = Number(m);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const year = y.length === 2 ? `20${y}` : y;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function findAmount(body: string, allowBare: boolean): { amount: number; end: number } | null {
  const patterns = allowBare ? [CUR_RE, KW_BEFORE_RE, KW_AFTER_RE, ANY_NUM_RE] : [CUR_RE, KW_BEFORE_RE, KW_AFTER_RE];
  for (const re of patterns) {
    const m = re.exec(body);
    if (m && m[1]) {
      const amount = Number(m[1].replace(/,/g, ''));
      if (Number.isFinite(amount) && amount > 0) {
        return { amount, end: m.index + m[0].length };
      }
    }
  }
  return null;
}

/** "from RAVI KUMAR on ..." -> "Ravi Kumar" */
function nameFromSms(body: string): string | null {
  const m = /\bfrom\s+([A-Za-z][A-Za-z .']*)/i.exec(body);
  if (!m || !m[1]) return null;
  const raw = (m[1].split(/\s+(?:on|via|ref|for|upi|txn)\b|[.,]/i)[0] ?? '').trim();
  const name = raw
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
  return name || null;
}

export function parsePasted(text: string): PastedEntry[] {
  const out: PastedEntry[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const sourceLine = rawLine.trim();
    if (!sourceLine) continue;

    const dm = DATE_RE.exec(sourceLine);
    const date = dm && dm[1] && dm[2] && dm[3] ? toISO(dm[1], dm[2], dm[3]) : null;

    const wa = WA_RE.exec(sourceLine);
    const sender = wa && wa[1] ? wa[1].trim() : '';
    const body = (wa && wa[2] ? wa[2] : sourceLine).replace(DATE_G, ' ');

    const kind: PastedEntry['kind'] | null = PAY_RE.test(body)
      ? 'payment'
      : INV_RE.test(body)
        ? 'invoice'
        : null;
    if (!kind) continue;

    const found = findAmount(body, kind === 'invoice');
    if (!found) continue;

    const tail = body.slice(found.end).trim();
    const description =
      kind === 'invoice'
        ? tail.replace(/^(?:for|-|:)\s*/i, '').trim() || body.trim()
        : (/\bfor\s+(.+)$/i.exec(tail)?.[1] ?? '').trim();

    const customerName = sender || nameFromSms(body) || 'Unknown';

    out.push({ kind, customerName, amount: found.amount, description, date, sourceLine });
  }
  return out;
}
