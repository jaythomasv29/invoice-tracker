import { localDay, type SpendInvoice } from './spendSummary.ts';
const milestones = [1, 5, 10, 25, 50, 100, 250, 500];
/** Progress uses saved invoice IDs and upload days, never spending or scan attempts. */
export function kitchenProgress(invoices: SpendInvoice[], now = new Date()) {
  const unique = [...new Map(invoices.map(i => [i.id, i])).values()];
  const count = unique.length;
  const target = milestones.find(n => n > count) ?? (Math.floor(count / 250) + 1) * 250;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const today = localDay(now);
  const uploaded = new Set(unique.flatMap(i => { const d = new Date(i.created_at); return Number.isFinite(d.getTime()) ? [localDay(d)] : []; }));
  const days = ['M','T','W','T','F','S','S'].map((label,index) => {
    const date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + index);
    const iso = localDay(date);
    return {label, iso, isToday: iso === today, logged: iso <= today && uploaded.has(iso), future: iso > today};
  });
  return {count, target, remaining: target-count, fraction:count/target, days, activeDays:days.filter(d=>d.logged).length,
    badges: milestones.filter(n=>n<=count).slice(-2).concat(target).map(n=>({value:n,earned:n<=count}))};
}
