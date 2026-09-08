const IGNORE_LINE_PATTERN = /(lista mayorista)|(^distribuidora)|(^codigo\s*descripcion)|(precios sujetos a cambios)|(\bp[aá]g\.?\s*\d)|(\btotal\b)|(\bsubtotal\b)|(\bcuit\b)|(\bfactura\b)|(\bremito\b)/i;
const NUMBER_TOKEN = /\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?|\d+/g;
const LEADING_CODE = /^(\d{1,6})\s*(.+)$/;

// pdf-parse often puts a table's rightmost column (the price, here) on its own
// line, so a product's price can arrive as a separate line from its
// code+description — this recognizes such a line so it can be re-joined with
// the description line that precedes it before per-line parsing runs.
const PRICE_ONLY_LINE = /^[\d.,]+\s*(?:\(sin\s*tacc\))?\s*(?:faltante)?$/i;

// Handles both "1.234,56" (comma decimal) and "1,234.56" (dot decimal) by
// treating whichever separator is last as the decimal point, since that's
// the one followed by 1-2 digits — everything before it is a thousands separator.
function parseLocaleNumber(raw: string): number {
  const s = raw.trim();
  const lastSep = Math.max(s.lastIndexOf(','), s.lastIndexOf('.'));
  if (lastSep === -1) return parseFloat(s) || 0;
  const decimalDigits = s.length - lastSep - 1;
  if (decimalDigits === 1 || decimalDigits === 2) {
    const integerPart = s.slice(0, lastSep).replace(/[.,]/g, '');
    const decimalPart = s.slice(lastSep + 1);
    return parseFloat(`${integerPart}.${decimalPart}`) || 0;
  }
  return parseFloat(s.replace(/[.,]/g, '')) || 0;
}

function cleanName(raw: string): string {
  return raw
    .replace(/\(sin\s*tacc\)/gi, '')
    .replace(/\bsin\s+cargo\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/[\s\-–|.:]+$/, '')
    .trim();
}

export interface ParsedInvoiceItem {
  name: string;
  quantity: number;
  cost: number;
  code?: string;
}

// Re-joins a price-only line with the description line before it, and drops
// boilerplate (headers/footers repeated on every page) so it never gets
// merged into a product's description.
function preprocessLines(text: string): string[] {
  const merged: string[] = [];
  let pending: string | null = null;

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    if (IGNORE_LINE_PATTERN.test(line)) {
      pending = null;
      continue;
    }

    if (PRICE_ONLY_LINE.test(line)) {
      if (pending) {
        merged.push(`${pending} ${line}`);
        pending = null;
      }
    } else {
      if (pending) merged.push(pending);
      pending = line;
    }
  }
  if (pending) merged.push(pending);
  return merged;
}

function parseInvoiceLine(line: string): ParsedInvoiceItem | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length < 4) return null;

  // Wholesale price lists usually lead each row with the supplier's own product
  // code (e.g. "3196ACEITE AEROSOL WD-40 12 x 155g. 7,760.00") and have no
  // quantity column — package sizes like "12 x 155g" inside the description
  // would otherwise be mistaken for a quantity, so we skip that heuristic here.
  const codeMatch = trimmed.match(LEADING_CODE);
  const code = codeMatch?.[1];
  const rest = codeMatch ? codeMatch[2] : trimmed;

  const matches = rest.match(NUMBER_TOKEN);
  if (!matches || matches.length === 0) return null;

  const rawCost = matches[matches.length - 1];
  const cost = parseLocaleNumber(rawCost);
  if (!cost || cost <= 0) return null;

  const costIndex = rest.lastIndexOf(rawCost);
  let nameEnd = costIndex;
  let quantity = code ? 0 : 1;

  if (!code && matches.length >= 2) {
    const rawQty = matches[matches.length - 2];
    const qtyIndex = rest.lastIndexOf(rawQty, costIndex - 1);
    const between = qtyIndex >= 0 ? rest.slice(qtyIndex + rawQty.length, costIndex) : '';
    const qtyNum = parseInt(rawQty.replace(/[.,]/g, ''), 10);
    const looksLikeQty = qtyIndex >= 0 && /^\s*$/.test(between) && qtyNum > 0 && qtyNum < 10000 && !rawQty.includes(',');
    if (looksLikeQty) {
      quantity = qtyNum;
      nameEnd = qtyIndex;
    }
  }

  const name = cleanName(rest.slice(0, nameEnd));
  if (!name || name.length < 2 || /^\d+$/.test(name)) return null;

  return { name, quantity, cost, code };
}

export function parseInvoiceText(text: string): ParsedInvoiceItem[] {
  const lines = preprocessLines(text);
  const items: ParsedInvoiceItem[] = [];
  for (const line of lines) {
    const item = parseInvoiceLine(line);
    if (item) items.push(item);
  }
  return items;
}
