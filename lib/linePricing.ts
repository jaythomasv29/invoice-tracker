export function printedCatchWeight(description: string): number | null {
  const match = description.match(/IN TOTAL\s*:\s*(\d+(?:\.\d+)?)\s*LBS?\b/i);
  const weight = match ? Number(match[1]) : NaN;
  return Number.isFinite(weight) && weight > 0 ? weight : null;
}
// Catch weight and printed discounts can make the line total differ from qty × price.
export function usesPrintedLineTotal(item: {qty:number;unitPrice:number;ext:number}): boolean {
  return Math.abs(Math.round(item.qty * item.unitPrice * 100) / 100 - item.ext) > 0.01;
}
export function validatedLineTotal(qty: number, unitPrice: number, explicit?: number): number {
  const value = explicit ?? Math.round(qty * unitPrice * 100) / 100;
  if (![qty,unitPrice,value].every(Number.isFinite) || qty <= 0 || unitPrice < 0 || value < 0) throw new Error('Enter valid quantities, prices and line total.');
  return Math.round(value * 100) / 100;
}
