import {
  DateRange,
  StatsSummary,
  StatsPeriodSummary,
} from 'src/app/services/stats.service';
import { StatMetricDto } from 'src/app/models/statsmetric.model';

export type RangePreset = '7' | '30' | '90' | 'custom';

export interface MetricDelta {
  current: number;
  previous: number;
  deltaText: string;
  deltaPositive: boolean;
}

export interface TrendPoint {
  label: string;
  value: number;
  height: number;
}

export function formatShortDate(value: string): string {
  if (!value) {
    return '—';
  }
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export function toDateInputValue(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function getSelectedRange(
  preset: RangePreset,
  customFrom: string,
  customTo: string
): DateRange {
  if (preset !== 'custom') {
    const days = Number(preset);
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - days + 1);
    return {
      from: toDateInputValue(from),
      to: toDateInputValue(to),
    };
  }

  return {
    from: customFrom || undefined,
    to: customTo || undefined,
  };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// Fallback only — used when the backend hasn't returned a previousPeriod
// (shouldn't normally happen; getSummary always computes one). Zeros, not
// fabricated numbers, so a missing previous period reads as "no prior data"
// rather than a misleading delta.
export function emptyPeriodSummary(): StatsPeriodSummary {
  return {
    totalApplications: 0,
    sentCount: 0,
    respondedCount: 0,
    viewedCount: 0,
    responseRate: 0,
    avgResponseDays: null,
    activeCount: 0,
    terminalCount: 0,
    neverViewedCount: 0,
    neverViewedRate: 0,
    ignoredCount: 0,
    ignoredRate: 0,
    interviewedCount: 0,
    offerCount: 0,
    interviewToOfferRate: null,
  };
}

export function makeMetricDelta(
  currentValue: number,
  previousValue: number
): MetricDelta {
  const current = Number.isFinite(currentValue) ? currentValue : 0;
  const previous = Number.isFinite(previousValue) ? previousValue : 0;
  const delta =
    previous === 0
      ? current > 0
        ? 100
        : 0
      : ((current - previous) / previous) * 100;
  const deltaText = `${delta >= 0 ? '+' : ''}${Math.abs(delta).toFixed(0)}%`;

  return {
    current,
    previous,
    deltaText,
    deltaPositive: delta >= 0,
  };
}

// NOTE: still synthetic — there is no getTrends() call to the real
// /api/stats/trends endpoint yet. These four charts are phase-curves derived
// from the current summary total, not actual day-by-day history. Flagged as
// a separate follow-up; not touched in this pass.
export function buildTrendSeries(
  kind: 'applications' | 'responseRate' | 'interviewToOffer' | 'rejections',
  summary: StatsSummary | null,
  preset: RangePreset
): TrendPoint[] {
  const points =
    preset === 'custom' ? 6 : preset === '7' ? 5 : preset === '30' ? 6 : 7;
  const totalDays =
    preset === '7' ? 7 : preset === '30' ? 30 : preset === '90' ? 90 : 30;

  const values = Array.from({ length: points }, (_, index) => {
    const phase = index / Math.max(points - 1, 1);
    if (kind === 'applications') {
      const base = summary?.totalApplications ?? 24;
      return Math.max(
        2,
        Math.round(base * (0.45 + phase * 0.75 + (index % 2) * 0.08))
      );
    }
    if (kind === 'responseRate') {
      const base = (summary?.responseRate ?? 0.26) * 100;
      return Math.max(
        5,
        Math.min(95, Number((base + (index - points / 2) * 7).toFixed(0)))
      );
    }
    if (kind === 'interviewToOffer') {
      const base = (summary?.interviewToOfferRate ?? 0.18) * 100;
      return Math.max(
        3,
        Math.min(75, Number((base + (index - points / 2) * 6).toFixed(0)))
      );
    }
    const base = summary?.terminalCount ?? 10;
    return Math.max(1, Math.round(base * (0.45 + phase * 0.75)));
  });

  const maxValue = Math.max(...values, 1);
  return values.map((value, index) => {
    const step = Math.max(1, Math.round(totalDays / points));
    const offset = totalDays - (points - index) * step;
    return {
      label: `${Math.max(1, offset)}d`,
      value,
      height: Math.max(12, (value / maxValue) * 100),
    };
  });
}
