export interface QuickAddDraft {
  customerName: string;
  amount: number;
  quantity: number;
  description: string;
  dueDays: number;
}

const DEFAULT_DUE_DAYS = 7;

const isNumber = (t: string): boolean => /^\d+(\.\d+)?$/.test(t);
const isInteger = (t: string): boolean => /^\d+$/.test(t);

/**
 * Forms accepted:
 *   "Meera 2 haircut 800 due 15 days"  -> name Meera, qty 2, "haircut", 800, 15 days
 *   "Ravi facial 1500"                 -> name Ravi, qty 1, "facial", 1500, 7 days
 */
export function parseQuickAdd(input: string): QuickAddDraft | null {
  // Strip rupee signs and thousands separators (1,500 -> 1500).
  let text = input.replace(/₹/g, ' ').replace(/(\d),(?=\d)/g, '$1');

  let dueDays = DEFAULT_DUE_DAYS;
  const dueMatch = /\bdue\s+(\d+)\s*days?\b/i.exec(text);
  if (dueMatch) {
    dueDays = parseInt(dueMatch[1], 10);
    text = text.replace(dueMatch[0], ' ');
  }

  const tokens = text.split(/\s+/).filter((t) => t.length > 0);
  const numIdx: number[] = [];
  tokens.forEach((t, i) => {
    if (isNumber(t)) numIdx.push(i);
  });
  if (numIdx.length === 0) return null;

  let customerName: string;
  let quantity: number;
  let description: string;
  let amountIdx: number;

  if (numIdx.length >= 2 && isInteger(tokens[numIdx[0]])) {
    // Name (may be multi-word), integer quantity, description words, amount.
    const qtyIdx = numIdx[0];
    amountIdx = numIdx[1];
    customerName = tokens.slice(0, qtyIdx).join(' ');
    quantity = parseInt(tokens[qtyIdx], 10);
    description = tokens.slice(qtyIdx + 1, amountIdx).join(' ');
  } else {
    // Single number is the amount; first word is the name, the rest is the description.
    amountIdx = numIdx[0];
    const nameLen = Math.min(1, amountIdx);
    customerName = tokens.slice(0, nameLen).join(' ');
    quantity = 1;
    description = tokens.slice(nameLen, amountIdx).join(' ');
  }

  return {
    customerName,
    amount: parseFloat(tokens[amountIdx]),
    quantity,
    description,
    dueDays,
  };
}
