import { useStore, DayData, SpendPeriod } from '../store/useStore';

export function spendPeriodLabel(period: SpendPeriod, yearsBack: number): string {
  switch (period) {
    case 'week': return "This week's spend";
    case 'month': return "This month's spend";
    case 'year': return yearsBack <= 1 ? "This year's spend" : `Last ${yearsBack} years' spend`;
    case 'all': return 'All-time spend';
  }
}

export function spendPeriodCompareLabel(period: SpendPeriod, yearsBack: number): string | null {
  switch (period) {
    case 'week': return 'vs last week';
    case 'month': return 'vs last month';
    case 'year': return yearsBack <= 1 ? 'vs last year' : `vs prior ${yearsBack}yr`;
    case 'all': return null;
  }
}

export function spendPeriodBadge(period: SpendPeriod, yearsBack: number): string {
  switch (period) {
    case 'week': return '7d';
    case 'month': return '30d';
    case 'year': return `${yearsBack}yr`;
    case 'all': return 'All';
  }
}

// Short form for pills next to a vendor's amount — same badge text works,
// just phrased as "this X" rather than a bare unit.
export function spendPeriodShortLabel(period: SpendPeriod, yearsBack: number): string {
  switch (period) {
    case 'week': return 'this week';
    case 'month': return 'this month';
    case 'year': return yearsBack <= 1 ? 'this year' : `last ${yearsBack}yr`;
    case 'all': return 'all time';
  }
}

interface SpendPeriodData {
  spendView: SpendPeriod;
  setSpendView: (view: SpendPeriod) => void;
  yearsBack: number;
  setYearsBack: (n: number) => void;
  maxYears: number;
  periodTotal: number;
  periodPctChange: number;
  periodBarData: DayData[];
}

// Single source of truth for "what period is selected and what does the
// aggregate chart look like for it" — both the home vendor list and the
// vendors-page graph/pills derive from this rather than each recomputing
// the week/month/year/all-time slicing independently.
export function useSpendPeriod(): SpendPeriodData {
  const {
    spendView, setSpendView, yearsBack, setYearsBack,
    weekTotal, weekPctChange, dayData,
    monthTotal, monthPctChange, monthData,
    allYearData,
  } = useStore();

  const maxYears = allYearData.length || 1;
  const clampedYearsBack = Math.max(1, Math.min(yearsBack, maxYears));
  const yearSlice = allYearData.slice(-clampedYearsBack);
  const yearTotal = Math.round(yearSlice.reduce((a, d) => a + d.total, 0) * 100) / 100;
  const priorYearSlice = allYearData.slice(-2 * clampedYearsBack, -clampedYearsBack);
  const priorYearTotal = priorYearSlice.reduce((a, d) => a + d.total, 0);
  const yearPctChange = priorYearTotal > 0
    ? Math.round(((yearTotal - priorYearTotal) / priorYearTotal) * 1000) / 10
    : (yearTotal > 0 ? 100 : 0);
  const allTimeTotal = Math.round(allYearData.reduce((a, d) => a + d.total, 0) * 100) / 100;

  let periodTotal: number;
  let periodPctChange: number;
  let periodBarData: DayData[];
  switch (spendView) {
    case 'week': periodTotal = weekTotal; periodPctChange = weekPctChange; periodBarData = dayData; break;
    case 'month': periodTotal = monthTotal; periodPctChange = monthPctChange; periodBarData = monthData; break;
    case 'year': periodTotal = yearTotal; periodPctChange = yearPctChange; periodBarData = yearSlice; break;
    case 'all': periodTotal = allTimeTotal; periodPctChange = 0; periodBarData = allYearData; break;
  }

  return {
    spendView, setSpendView,
    yearsBack: clampedYearsBack, setYearsBack,
    maxYears,
    periodTotal, periodPctChange, periodBarData,
  };
}
