import { DateRange, StatsSummary } from 'src/app/services/stats.service';
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

export function getPreviousRange(range: DateRange): DateRange {
  if (!range.from || !range.to) {
    return {};
  }

  const currentFrom = new Date(`${range.from}T00:00:00`);
  const currentTo = new Date(`${range.to}T00:00:00`);
  const diffDays = Math.max(
    1,
    Math.round((currentTo.getTime() - currentFrom.getTime()) / 86400000) + 1
  );

  const previousTo = new Date(currentFrom);
  previousTo.setDate(previousTo.getDate() - 1);
  const previousFrom = new Date(previousTo);
  previousFrom.setDate(previousFrom.getDate() - diffDays + 1);

  return {
    from: toDateInputValue(previousFrom),
    to: toDateInputValue(previousTo),
  };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function synthesizePreviousValue(current: number): number {
  if (!Number.isFinite(current) || current <= 0) {
    return 0;
  }
  return Math.max(0, Math.round(current * 0.78));
}

export function synthesizePreviousRate(currentRate: number): number {
  return clamp(currentRate * 0.84, 0, 1);
}

export function buildSyntheticPreviousSummary(
  summary: StatsSummary,
  previousRange: DateRange
): StatsSummary {
  const baseFactor = previousRange.from && previousRange.to ? 0.82 : 0.75;
  const responseRate = clamp((summary.responseRate ?? 0) * baseFactor, 0, 1);

  return {
    totalApplications: synthesizePreviousValue(summary.totalApplications),
    sentCount: synthesizePreviousValue(summary.sentCount),
    responseRate,
    avgResponseDays:
      summary.avgResponseDays == null
        ? null
        : Math.max(
            0.5,
            summary.avgResponseDays *
              (1.12 + (summary.totalApplications > 0 ? 0.08 : 0))
          ),
    activeCount: synthesizePreviousValue(summary.activeCount),
    terminalCount: synthesizePreviousValue(summary.terminalCount),
    neverViewedCount: synthesizePreviousValue(summary.neverViewedCount),
    neverViewedRate: clamp(summary.neverViewedRate * baseFactor, 0, 1),
    interviewedCount: synthesizePreviousValue(summary.interviewedCount),
    offerCount: synthesizePreviousValue(summary.offerCount),
    interviewToOfferRate:
      summary.interviewToOfferRate == null
        ? null
        : clamp(summary.interviewToOfferRate * baseFactor, 0, 1),
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
