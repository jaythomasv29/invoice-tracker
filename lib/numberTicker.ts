/** Finite, clamped easing: the display lands exactly on the actual saved value. */
export function tickerValue(
  from: number,
  to: number,
  elapsed: number,
  duration = 800,
): number {
  if (!Number.isFinite(to)) return 0;
  if (!Number.isFinite(from) || duration <= 0 || elapsed >= duration) return to;
  const t = Math.max(0, elapsed / duration);
  return from + (to - from) * (1 - Math.pow(1 - t, 3));
}
