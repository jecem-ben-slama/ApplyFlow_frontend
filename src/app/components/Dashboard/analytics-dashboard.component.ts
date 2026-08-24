import {
  Component,
  DestroyRef,
  OnInit,
  ViewChild,
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
import {
  ApplicationBoardComponent,
  KanbanStatusChange,
} from './application-board/application-board.component';
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
  FunnelStage,
  RejectionStage,
  StatsPeriodSummary,
  StatsService,
  StatsSummary,
  StatsTrendResponse,
  TimelineEvent,
  TrendGranularity,
  TrendPoint,
} from 'src/app/services/stats.service';
import { PendingSelectionService } from 'src/app/services/pending-selection.service';
import { ApplicationsService } from 'src/app/services/applications.service';
import { ApplicationActionService } from 'src/app/services/application-action.service';
// NOTE: adjust this path to wherever ToastService actually lives in your tree —
// I've matched the pattern used elsewhere (src/app/services/...); it may
// instead be under src/app/components/common/toast/toast.service.
import { ToastService } from 'src/app/components/common/toast/toast.service';

import {
  RangePreset,
  emptyPeriodSummary,
  formatShortDate,
  getSelectedRange,
  makeMetricDelta,
} from './analytics.utils';
import { ToastContainerComponent } from '../common/toast/toast-container.component';

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

// A chart-ready point for the trend bar rows in the template. `height` is
// pre-normalized to 0-100 (percent of the max value in the series) so the
// template can bind it straight to [style.height.%].
interface ChartPoint {
  label: string;
  value: number;
  height: number;
}

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
    ToastContainerComponent,
  ],
  templateUrl: './analytics-dashboard.component.html',
})
export class AnalyticsDashboardComponent implements OnInit {
  private statsService = inject(StatsService);
  private analyticsService = inject(AnalyticsService);
  private applicationsService = inject(ApplicationsService);
  private toastService = inject(ToastService);
  private destroyRef = inject(DestroyRef);
  private pendingSelection = inject(PendingSelectionService);
  private actionService = inject(ApplicationActionService);

  /** Reference to the kanban board so a failed status PATCH can tell it to roll a card back. */
  @ViewChild(ApplicationBoardComponent) board?: ApplicationBoardComponent;

  readonly outcomeStatuses = OUTCOME_STATUSES;
  readonly statusOrder = STATUS_ORDER;
  readonly kanbanCap = KANBAN_COLUMN_CAP;
  readonly lowSampleThreshold = MIN_SAMPLE_SIZE;
  readonly rangeOptions = [
    { id: '7', label: '7 days' },
    { id: '30', label: '30 days' },
    { id: '90', label: '90 days' },
  ] as const;

  // Overview
  summary = signal<StatsSummary | null>(null);
  // Real previous-period numbers from the backend (summary.previousPeriod),
  // not fabricated. Defaults to zeros if the backend ever omits it.
  previousSummary = signal<StatsPeriodSummary | null>(null);
  funnelStages = signal<DisplayFunnelStage[]>([]);
  rejectionStages = signal<RejectionStage[]>([]);
  loading = signal(true);
  loadError = signal(false);

  // Trend analysis — real per-bucket series from /api/stats/trends, scoped
  // to the same date range as everything else on the dashboard.
  trends = signal<StatsTrendResponse | null>(null);

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

  // Custom-range popover. Draft values are edited separately from
  // customFrom/customTo so picking a "From" date doesn't fetch until the
  // person explicitly applies — and Cancel can discard an in-progress edit
  // without disturbing an already-applied custom range.
  customRangeOpen = signal(false);
  draftFrom = signal('');
  draftTo = signal('');

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
    return `${formatShortDate(from)} – ${formatShortDate(to)}`;
  });

  // Label shown on the Custom button itself — "Custom range" until one has
  // actually been applied, then the picked dates, reusing rangeLabel's
  // formatting so the two never drift out of sync.
  customButtonLabel = computed(() =>
    this.selectedPreset() === 'custom' ? this.rangeLabel() : 'Custom range'
  );

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

  ignoredPercentage = computed(() =>
    Math.round((this.summary()?.ignoredRate ?? 0) * 100)
  );

  respondedCountLabel = computed(() => this.summary()?.respondedCount ?? 0);
  viewedCountLabel = computed(() => this.summary()?.viewedCount ?? 0);

  kpiComparison = computed(() => {
    const current = this.summary();
    if (!current) {
      return {
        totalApplications: makeMetricDelta(0, 0),
        sentCount: makeMetricDelta(0, 0),
        responseRate: makeMetricDelta(0, 0),
        avgResponseDays: makeMetricDelta(0, 0),
        activeCount: makeMetricDelta(0, 0),
        interviewToOfferRate: makeMetricDelta(0, 0),
        ignoredCount: makeMetricDelta(0, 0),
      };
    }

    const previous = this.previousSummary() ?? emptyPeriodSummary();

    return {
      totalApplications: makeMetricDelta(
        current.totalApplications,
        previous.totalApplications
      ),
      sentCount: makeMetricDelta(current.sentCount, previous.sentCount),
      responseRate: makeMetricDelta(
        current.responseRate * 100,
        previous.responseRate * 100
      ),
      avgResponseDays: makeMetricDelta(
        current.avgResponseDays ?? 0,
        previous.avgResponseDays ?? 0
      ),
      activeCount: makeMetricDelta(current.activeCount, previous.activeCount),
      interviewToOfferRate: makeMetricDelta(
        current.interviewToOfferRate == null
          ? 0
          : current.interviewToOfferRate * 100,
        previous.interviewToOfferRate == null
          ? 0
          : previous.interviewToOfferRate * 100
      ),
      ignoredCount: makeMetricDelta(
        current.ignoredCount,
        previous.ignoredCount
      ),
    };
  });

  // Trend charts — built from the real /api/stats/trends response instead
  // of being fabricated from the single-number summary. The backend returns
  // four independent series (not one array with multiple metrics per
  // point), so each chart reads its own array directly.
  applicationsTrend = computed<ChartPoint[]>(() =>
    this.toChartPoints(
      this.trends()?.applicationsOverTime ?? [],
      (p) => p.value
    )
  );

  responseRateTrend = computed<ChartPoint[]>(() =>
    this.toChartPoints(this.trends()?.responseRateOverTime ?? [], (p) =>
      this.toPercentValue(p)
    )
  );

  interviewTrend = computed<ChartPoint[]>(() =>
    this.toChartPoints(this.trends()?.interviewToOfferRateOverTime ?? [], (p) =>
      this.toPercentValue(p)
    )
  );

  rejectionTrend = computed<ChartPoint[]>(() =>
    this.toChartPoints(
      this.trends()?.rejectionTrendOverTime ?? [],
      (p) => p.value
    )
  );

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

    const pendingId = this.pendingSelection.consumePendingAppId();
    if (pendingId != null) {
      this.onSelectApplication(pendingId);
    }
  }

  setPreset(preset: RangePreset): void {
    this.customRangeOpen.set(false);
    this.selectedPreset.set(preset);
    if (preset !== 'custom') {
      this.customFrom.set('');
      this.customTo.set('');
    }
    this.refreshDashboard();
  }

  // Opens the popover, seeding its drafts from whatever custom range (if
  // any) is currently applied so re-opening to tweak a date doesn't lose
  // the other one.
  openCustomRange(): void {
    this.draftFrom.set(this.customFrom());
    this.draftTo.set(this.customTo());
    this.customRangeOpen.set(true);
  }

  confirmCustomRange(): void {
    if (!this.draftFrom() || !this.draftTo()) {
      return;
    }
    this.customFrom.set(this.draftFrom());
    this.customTo.set(this.draftTo());
    this.selectedPreset.set('custom');
    this.customRangeOpen.set(false);
    this.refreshDashboard();
  }

  // Closes without fetching. If no custom range was ever successfully
  // applied, falls back to the default preset rather than leaving the
  // segmented control pointed at an empty "Custom range".
  cancelCustomRange(): void {
    this.customRangeOpen.set(false);
    if (
      this.selectedPreset() !== 'custom' ||
      !this.customFrom() ||
      !this.customTo()
    ) {
      this.setPreset('30');
    }
  }

  private refreshDashboard(): void {
    const range = getSelectedRange(
      this.selectedPreset(),
      this.customFrom(),
      this.customTo()
    );
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
          this.summary.set(summary);
          // Real previous-period data from the backend — no more fabricated numbers.
          this.previousSummary.set(
            summary.previousPeriod ?? emptyPeriodSummary()
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
          this.previousSummary.set(null);
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
        next: (events) => {
          this.applicationTimeline.set(this.withDaysAgo(events));
          this.scrollToTimeline();
        },
        error: () => this.loadError.set(true),
      });
  }

  private scrollToTimeline(): void {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = document.getElementById('timeline-section');
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  /**
   * Handles a drag-and-drop status change from the kanban board with Undo support.
   */
  onBoardStatusChanged(change: KanbanStatusChange): void {
    // 1. Optimistically update the shared applications signal immediately so
    // every other widget on the dashboard (funnel stages, outcome counts)
    // stays in sync with the board without waiting on a full reload.
    this.applications.update((apps) =>
      apps.map((app) =>
        app.id === change.id ? { ...app, status: change.to } : app
      )
    );

    // 2. Queue the backend call via ApplicationActionService to allow the undo window
    this.actionService.queueStatusChange(
      change.id,
      change.to,
      () => {
        this.toastService.success(`Moved to ${STATUS_LABELS[change.to]}.`);
      },
      (err) => {
        this.toastService.error(
          err.error?.message || 'Could not update status.'
        );
        this.revertBoardMove(change);
      }
    );

    // 3. Show an actionable Toast with an Undo button
    const toastDuration = this.actionService.UNDO_WINDOW_MS;
    this.toastService.info(
    
      `Moving to ${STATUS_LABELS[change.to]}...`,
    this.actionService.UNDO_WINDOW_MS,
     {
        label: 'Undo',
        onClick: () => {
          this.actionService.cancelStatusChange(change.id);
          this.revertBoardMove(change);
          this.toastService.info('Status change cancelled.');
        },
      },
    );
  }

  private revertBoardMove(change: KanbanStatusChange): void {
    this.board?.revert(change);
    this.applications.update((apps) =>
      apps.map((app) =>
        app.id === change.id ? { ...app, status: change.from } : app
      )
    );
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

  trackByLabel(_index: number, point: ChartPoint): string {
    return point.label;
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

  // Each event's age is computed independently against "now" — not against
  // its neighbor in the array — so this is agnostic to whatever order the
  // backend returns events in. Sorting here only controls display order
  // (oldest first, matching "how it evolved over time"), not the
  // day-count math.
  private withDaysAgo(events: TimelineEvent[]): TimelineEventDisplay[] {
    const now = Date.now();
    const sorted = [...events].sort(
      (a, b) =>
        new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()
    );
    return sorted.map((event) => {
      const occurred = new Date(event.occurredAt).getTime();
      if (Number.isNaN(occurred)) {
        return { ...event, daysAgo: null };
      }
      const daysAgo = Math.max(
        0,
        Math.round((now - occurred) / (1000 * 60 * 60 * 24))
      );
      return { ...event, daysAgo };
    });
  }

  // Daily buckets for short ranges, weekly for the 90-day preset (and any
  // custom range spanning more than ~45 days) so the chart doesn't try to
  // cram dozens of daily bars into a small area, monthly beyond ~180 days.
  private granularityForPreset(
    preset: RangePreset,
    range: { from?: string; to?: string }
  ): TrendGranularity {
    if (preset === '7' || preset === '30') {
      return 'DAY';
    }
    if (preset === '90') {
      return 'WEEK';
    }
    // custom
    if (range.from && range.to) {
      const days =
        (new Date(range.to).getTime() - new Date(range.from).getTime()) /
        (1000 * 60 * 60 * 24);
      if (days > 180) return 'MONTH';
      if (days > 45) return 'WEEK';
    }
    return 'DAY';
  }

  // TrendPointDto has no pre-formatted label — only a LocalDate `date` — so
  // the axis label is built client-side from formatShortDate.
  private toPercentValue(point: TrendPoint): number {
    if (point.percent == null) {
      return 0;
    }
    return Math.round(point.percent);
  }

  // Normalizes a trend series to 0-100 heights for the CSS bar chart.
  private toChartPoints(
    points: TrendPoint[],
    selector: (point: TrendPoint) => number
  ): ChartPoint[] {
    if (points.length === 0) {
      return [];
    }
    const values = points.map(selector);
    const maxValue = Math.max(...values, 1);
    return points.map((point, index) => ({
      label: formatShortDate(point.date),
      value: values[index],
      // Floor at 2% so a real zero-value bucket still renders a sliver
      // instead of being visually indistinguishable from "no data".
      height: Math.max(Math.round((values[index] / maxValue) * 100), 2),
    }));
  }
}
