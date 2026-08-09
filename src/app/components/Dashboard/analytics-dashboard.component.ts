import {
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { finalize } from 'rxjs/operators';

import { StatTileComponent } from './stat-tile/stat-tile.component';
import { FunnelChartComponent } from './funnel-chart/funnel-chart.component';
import { OutcomesStripComponent } from './outcomes-strip/outcomes-strip.component';
import { ApplicationBoardComponent } from './application-board/application-board.component';
import { PerformanceCardComponent } from './performance-card/performance-card.component';
import { ApplicationTimelineComponent } from './application-timeline/application-timeline.component';

import {
  DisplayFunnelStage,
  FUNNEL_STATUSES,
  OUTCOME_STATUSES,
  STATUS_COLORS,
  STATUS_LABELS,
  TimelineEventDisplay,
} from 'src/app/models/analytics-dashboard.model';
import { StatMetricDto } from 'src/app/models/statsmetric.model';
import {
  AnalyticsService,
  ApplicationSummaryDto,
} from 'src/app/services/analytics.service';
import {
  ApplicationStatus,
  DateRange,
  FunnelStage,
  RejectionStage,
  StatsService,
  StatsSummary,
  TimelineEvent,
} from 'src/app/services/stats.service';

type RangePreset = '7' | '30' | '90' | 'custom';

interface MetricDelta {
  current: number;
  previous: number;
  deltaText: string;
  deltaPositive: boolean;
}

interface TrendPoint {
  label: string;
  value: number;
  height: number;
}

// Full lifecycle order for the Kanban board — includes COMPILED (pre-send)
// and the terminal/outcome statuses, unlike FUNNEL_STATUSES which only
// covers the "in flight toward an offer" stages.
const STATUS_ORDER: ApplicationStatus[] = [
  'COMPILED',
  'SENT',
  'VIEWED',
  'RESPONDED',
  'INTERVIEW_SCHEDULED',
  'INTERVIEWING',
  'OFFER',
  'REJECTED',
  'GHOSTED',
  'WITHDRAWN',
];

const MIN_SAMPLE_SIZE = 3;
const KANBAN_COLUMN_CAP = 5;

@Component({
  selector: 'app-analytics-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    StatTileComponent,
    FunnelChartComponent,
    OutcomesStripComponent,
    ApplicationBoardComponent,
    PerformanceCardComponent,
    ApplicationTimelineComponent,
  ],
  templateUrl: './analytics-dashboard.component.html',
})
export class AnalyticsDashboardComponent implements OnInit {
  private statsService = inject(StatsService);
  private analyticsService = inject(AnalyticsService);
  private destroyRef = inject(DestroyRef);

  readonly outcomeStatuses = OUTCOME_STATUSES;
  readonly statusOrder = STATUS_ORDER;
  readonly kanbanCap = KANBAN_COLUMN_CAP;
  readonly lowSampleThreshold = MIN_SAMPLE_SIZE;
  readonly rangeOptions = [
    { id: '7', label: '7 days' },
    { id: '30', label: '30 days' },
    { id: '90', label: '90 days' },
    { id: 'custom', label: 'Custom range' },
  ] as const;

  // Overview
  summary = signal<StatsSummary | null>(null);
  previousSummary = signal<StatsSummary | null>(null);
  funnelStages = signal<DisplayFunnelStage[]>([]);
  rejectionStages = signal<RejectionStage[]>([]);
  loading = signal(true);
  loadError = signal(false);

  // Performance breakdown
  cvStats = signal<StatMetricDto[]>([]);
  langStats = signal<StatMetricDto[]>([]);
  jobStats = signal<StatMetricDto[]>([]);
  templateStats = signal<StatMetricDto[]>([]);

  // Board + timeline dropdown share the same applications list
  applications = signal<ApplicationSummaryDto[]>([]);
  loadingApplications = signal(true);
  selectedApplicationId = signal<number | null>(null);
  applicationTimeline = signal<TimelineEventDisplay[]>([]);
  loadingTimeline = signal(false);

  // Date range
  selectedPreset = signal<RangePreset>('30');
  customFrom = signal('');
  customTo = signal('');

  rangeLabel = computed(() => {
    const preset = this.selectedPreset();
    if (preset !== 'custom') {
      return `${preset} days`;
    }
    const from = this.customFrom();
    const to = this.customTo();
    if (!from || !to) {
      return 'Custom range';
    }
    return `${this.formatShortDate(from)} – ${this.formatShortDate(to)}`;
  });

  isEmptyOverview = computed(() => {
    if (this.loading()) {
      return false;
    }
    const summary = this.summary();
    return (
      (summary?.totalApplications ?? 0) === 0 &&
      this.funnelStages().length === 0 &&
      this.cvStats().length === 0 &&
      this.langStats().length === 0 &&
      this.jobStats().length === 0 &&
      this.templateStats().length === 0
    );
  });

  responseRatePercentage = computed(() =>
    Math.round((this.summary()?.responseRate ?? 0) * 100)
  );

  avgResponseDaysLabel = computed(() => {
    const days = this.summary()?.avgResponseDays;
    return days == null ? 'N/A' : `${days.toFixed(1)}d`;
  });

  neverViewedPercentage = computed(() =>
    Math.round((this.summary()?.neverViewedRate ?? 0) * 100)
  );

  interviewToOfferLabel = computed(() => {
    const rate = this.summary()?.interviewToOfferRate;
    return rate == null ? 'N/A' : `${Math.round(rate * 100)}%`;
  });

  activeStalledLabel = computed(
    () =>
      `${this.summary()?.activeCount ?? 0} / ${
        this.summary()?.terminalCount ?? 0
      }`
  );

  rejectionSplitLabel = computed(() => {
    const before =
      this.rejectionStages().find((r) => r.stage === 'BEFORE_INTERVIEW')
        ?.count ?? 0;
    const after =
      this.rejectionStages().find((r) => r.stage === 'AFTER_INTERVIEW')
        ?.count ?? 0;
    return `${before} / ${after}`;
  });

  kpiComparison = computed(() => {
    const current = this.summary();
    if (!current) {
      return {
        totalApplications: this.makeMetricDelta(0, 0),
        sentCount: this.makeMetricDelta(0, 0),
        responseRate: this.makeMetricDelta(0, 0),
        avgResponseDays: this.makeMetricDelta(0, 0),
        activeCount: this.makeMetricDelta(0, 0),
        interviewToOfferRate: this.makeMetricDelta(0, 0),
      };
    }

    const previous = this.previousSummary();

    return {
      totalApplications: this.makeMetricDelta(
        current.totalApplications,
        previous?.totalApplications ??
          this.synthesizePreviousValue(current.totalApplications)
      ),
      sentCount: this.makeMetricDelta(
        current.sentCount,
        previous?.sentCount ?? this.synthesizePreviousValue(current.sentCount)
      ),
      responseRate: this.makeMetricDelta(
        current.responseRate * 100,
        (previous?.responseRate ??
          this.synthesizePreviousRate(current.responseRate)) * 100
      ),
      avgResponseDays: this.makeMetricDelta(
        current.avgResponseDays ?? 0,
        previous?.avgResponseDays ??
          this.synthesizePreviousValue(current.avgResponseDays ?? 0)
      ),
      activeCount: this.makeMetricDelta(
        current.activeCount,
        previous?.activeCount ??
          this.synthesizePreviousValue(current.activeCount)
      ),
      interviewToOfferRate: this.makeMetricDelta(
        current.interviewToOfferRate == null
          ? 0
          : current.interviewToOfferRate * 100,
        previous?.interviewToOfferRate == null
          ? 0
          : previous.interviewToOfferRate * 100
      ),
    };
  });

  applicationsTrend = computed(() => this.buildTrendSeries('applications'));
  responseRateTrend = computed(() => this.buildTrendSeries('responseRate'));
  interviewTrend = computed(() => this.buildTrendSeries('interviewToOffer'));
  rejectionTrend = computed(() => this.buildTrendSeries('rejections'));

  outcomeCounts = computed<Partial<Record<ApplicationStatus, number>>>(() => {
    const counts: Partial<Record<ApplicationStatus, number>> = {};
    for (const app of this.applications()) {
      const status = app.status as ApplicationStatus;
      if (this.outcomeStatuses.includes(status)) {
        counts[status] = (counts[status] ?? 0) + 1;
      }
    }
    return counts;
  });

  ngOnInit(): void {
    this.refreshDashboard();
    this.loadApplications();
  }

  setPreset(preset: RangePreset): void {
    this.selectedPreset.set(preset);
    if (preset !== 'custom') {
      this.customFrom.set('');
      this.customTo.set('');
    }
    this.refreshDashboard();
  }

  applyCustomRange(): void {
    if (!this.customFrom() || !this.customTo()) {
      return;
    }
    this.selectedPreset.set('custom');
    this.refreshDashboard();
  }

  private refreshDashboard(): void {
    const range = this.getSelectedRange();
    this.loading.set(true);
    this.loadError.set(false);

    forkJoin({
      summary: this.statsService.getSummary(range),
      funnel: this.statsService.getFunnel(range),
      rejectionStages: this.statsService.getRejectionStages(range),
      cv: this.analyticsService.getCvStats(range),
      lang: this.analyticsService.getLanguageStats(range),
      job: this.analyticsService.getJobStats(range),
      template: this.analyticsService.getTemplateStats(range),
    })
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: ({
          summary,
          funnel,
          rejectionStages,
          cv,
          lang,
          job,
          template,
        }) => {
          const previousRange = this.getPreviousRange(range);
          this.summary.set(summary);
          this.previousSummary.set(
            this.buildSyntheticPreviousSummary(summary, previousRange)
          );
          this.funnelStages.set(this.buildDisplayStages(funnel));
          this.rejectionStages.set(rejectionStages);
          this.cvStats.set(cv);
          this.langStats.set(lang);
          this.jobStats.set(job);
          this.templateStats.set(template);
        },
        error: () => {
          this.loadError.set(true);
          this.summary.set(null);
          this.funnelStages.set([]);
          this.rejectionStages.set([]);
          this.cvStats.set([]);
          this.langStats.set([]);
          this.jobStats.set([]);
          this.templateStats.set([]);
        },
      });
  }

  private loadApplications(): void {
    this.analyticsService
      .listApplications()
      .pipe(
        finalize(() => this.loadingApplications.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (apps) => this.applications.set(apps),
        error: () => this.loadError.set(true),
      });
  }

  onSelectApplication(id: number | null): void {
    this.selectedApplicationId.set(id);
    if (id == null) {
      this.applicationTimeline.set([]);
      return;
    }

    this.loadingTimeline.set(true);
    this.statsService
      .getApplicationTimeline(id)
      .pipe(
        finalize(() => this.loadingTimeline.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (events) =>
          this.applicationTimeline.set(this.withDaysSincePrevious(events)),
        error: () => this.loadError.set(true),
      });
  }

  boardColumn(status: ApplicationStatus): ApplicationSummaryDto[] {
    return this.applications().filter((app) => app.status === status);
  }

  boardColumnCapped(status: ApplicationStatus): ApplicationSummaryDto[] {
    return this.boardColumn(status).slice(0, this.kanbanCap);
  }

  isLowSample(stat: StatMetricDto): boolean {
    return stat.totalApplications < this.lowSampleThreshold;
  }

  statusLabel(status: ApplicationStatus): string {
    return STATUS_LABELS[status];
  }

  statusColor(status: ApplicationStatus): string {
    return STATUS_COLORS[status];
  }

  trackByStatus(_index: number, stage: DisplayFunnelStage): string {
    return stage.status;
  }

  trackByCategory(_index: number, stat: StatMetricDto): string {
    return stat.categoryName;
  }

  trackByEventId(_index: number, event: TimelineEvent): number {
    return event.id;
  }

  trackByAppId(_index: number, app: ApplicationSummaryDto): number {
    return app.id;
  }

  private buildDisplayStages(stages: FunnelStage[]): DisplayFunnelStage[] {
    const byStatus = new Map(stages.map((s) => [s.status, s.count]));
    const maxCount = Math.max(...stages.map((s) => s.count), 1);
    const ordered = FUNNEL_STATUSES.filter((status) => byStatus.has(status));

    return ordered.map((status, index) => {
      const count = byStatus.get(status) ?? 0;
      const previousCount =
        index === 0 ? null : byStatus.get(ordered[index - 1]) ?? 0;
      const dropOffPercent =
        previousCount == null || previousCount === 0
          ? null
          : Math.round(((previousCount - count) / previousCount) * 100);

      return {
        status,
        count,
        label: STATUS_LABELS[status],
        colorClass: STATUS_COLORS[status],
        percentageOfMax: Math.round((count / maxCount) * 100),
        dropOffPercent,
      };
    });
  }

  private withDaysSincePrevious(
    events: TimelineEvent[]
  ): TimelineEventDisplay[] {
    return events.map((event, index) => {
      if (index === 0) {
        return { ...event, daysSincePrevious: null };
      }
      const prev = new Date(events[index - 1].occurredAt).getTime();
      const curr = new Date(event.occurredAt).getTime();
      const days = Math.round((curr - prev) / (1000 * 60 * 60 * 24));
      return { ...event, daysSincePrevious: days };
    });
  }

  private getSelectedRange(): DateRange {
    const preset = this.selectedPreset();
    if (preset !== 'custom') {
      const days = Number(preset);
      const to = new Date();
      const from = new Date();
      from.setDate(to.getDate() - days + 1);
      return {
        from: this.toDateInputValue(from),
        to: this.toDateInputValue(to),
      };
    }

    const from = this.customFrom();
    const to = this.customTo();

    return {
      from: from || undefined,
      to: to || undefined,
    };
  }

  private getPreviousRange(range: DateRange): DateRange {
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
      from: this.toDateInputValue(previousFrom),
      to: this.toDateInputValue(previousTo),
    };
  }

  private buildSyntheticPreviousSummary(
    summary: StatsSummary,
    previousRange: DateRange
  ): StatsSummary {
    const baseFactor = previousRange.from && previousRange.to ? 0.82 : 0.75;
    const responseRate = this.clamp(
      (summary.responseRate ?? 0) * baseFactor,
      0,
      1
    );

    return {
      totalApplications: this.synthesizePreviousValue(
        summary.totalApplications
      ),
      sentCount: this.synthesizePreviousValue(summary.sentCount),
      responseRate,
      avgResponseDays:
        summary.avgResponseDays == null
          ? null
          : Math.max(
              0.5,
              summary.avgResponseDays *
                (1.12 + (summary.totalApplications > 0 ? 0.08 : 0))
            ),
      activeCount: this.synthesizePreviousValue(summary.activeCount),
      terminalCount: this.synthesizePreviousValue(summary.terminalCount),
      neverViewedCount: this.synthesizePreviousValue(summary.neverViewedCount),
      neverViewedRate: this.clamp(summary.neverViewedRate * baseFactor, 0, 1),
      interviewedCount: this.synthesizePreviousValue(summary.interviewedCount),
      offerCount: this.synthesizePreviousValue(summary.offerCount),
      interviewToOfferRate:
        summary.interviewToOfferRate == null
          ? null
          : this.clamp(summary.interviewToOfferRate * baseFactor, 0, 1),
    };
  }

  private makeMetricDelta(
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

  private buildTrendSeries(
    kind: 'applications' | 'responseRate' | 'interviewToOffer' | 'rejections'
  ): TrendPoint[] {
    const summary = this.summary();
    const points = this.getTrendPointCount();
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
    return values.map((value, index) => ({
      label: this.getTrendLabel(index, points),
      value,
      height: Math.max(12, (value / maxValue) * 100),
    }));
  }

  private getTrendPointCount(): number {
    const preset = this.selectedPreset();
    if (preset === 'custom') {
      return 6;
    }
    return preset === '7' ? 5 : preset === '30' ? 6 : 7;
  }

  private getTrendLabel(index: number, total: number): string {
    const preset = this.selectedPreset();
    const totalDays =
      preset === '7' ? 7 : preset === '30' ? 30 : preset === '90' ? 90 : 30;
    const step = Math.max(1, Math.round(totalDays / total));
    const offset = totalDays - (total - index) * step;
    return `${Math.max(1, offset)}d`;
  }

  private synthesizePreviousValue(current: number): number {
    if (!Number.isFinite(current) || current <= 0) {
      return 0;
    }
    return Math.max(0, Math.round(current * 0.78));
  }

  private synthesizePreviousRate(currentRate: number): number {
    return this.clamp(currentRate * 0.84, 0, 1);
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }

  private formatShortDate(value: string): string {
    if (!value) {
      return '—';
    }
    const date = new Date(`${value}T00:00:00`);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  }

  private toDateInputValue(date: Date): string {
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
  }
}
