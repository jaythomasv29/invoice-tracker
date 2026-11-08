// Pure text for a vendor credit request (no React Native imports, so it's unit-testable).
import { money2 } from './money.ts';

export type CreditLine = {
  id: string;
  desc: string;
  qty: number;
  unit: string;
  ext: number;
};

export type CreditRequestInput = {
  vendorName: string;
  invoiceNumber: string;
  date: string; // display date, may be empty
  restaurantName?: string | null;
  lines: CreditLine[];
};

const fmtQty = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100));

export function creditTotal(lines: Pick<CreditLine, 'ext'>[]): number {
  return Math.round(lines.reduce((s, l) => s + (Number.isFinite(l.ext) ? l.ext : 0), 0) * 100) / 100;
}

export function buildCreditRequestMessage(input: CreditRequestInput): string {
  const { vendorName, invoiceNumber, date, restaurantName, lines } = input;
  const ref = [invoiceNumber ? `invoice #${invoiceNumber}` : 'our invoice', date ? `dated ${date}` : '']
    .filter(Boolean).join(' ');
  const items = lines.map((l) => `• ${l.desc} — ${fmtQty(l.qty)} ${l.unit}`.trimEnd() + ` ($${money2(l.ext)})`);
  const n = lines.length;
  return [
    `Hi ${vendorName || 'there'},`,
    '',
    `On ${ref}, the following ${n === 1 ? 'item was' : `${n} items were`} billed but not received:`,
    '',
    ...items,
    '',
    `Total: $${money2(creditTotal(lines))}`,
    '',
    'Could you please issue a credit for these on our next invoice? Thank you!',
    ...(restaurantName ? ['', restaurantName] : []),
  ].join('\n');
}

