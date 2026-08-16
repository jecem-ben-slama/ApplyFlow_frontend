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
  FunnelStage,
  RejectionStage,
  StatsService,
  StatsSummary,
  TimelineEvent,
} from 'src/app/services/stats.service';
import { PendingSelectionService } from 'src/app/services/pending-selection.service';

import {
  RangePreset,
  formatShortDate,
  getSelectedRange,
  getPreviousRange,
  buildSyntheticPreviousSummary,
  synthesizePreviousValue,
  synthesizePreviousRate,
  makeMetricDelta,
  buildTrendSeries,
} from './analytics.utils';

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
  private pendingSelection = inject(PendingSelectionService);

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
    return `${formatShortDate(from)} – ${formatShortDate(to)}`;
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
        totalApplications: makeMetricDelta(0, 0),
        sentCount: makeMetricDelta(0, 0),
        responseRate: makeMetricDelta(0, 0),
        avgResponseDays: makeMetricDelta(0, 0),
        activeCount: makeMetricDelta(0, 0),
        interviewToOfferRate: makeMetricDelta(0, 0),
      };
    }

    const previous = this.previousSummary();

    return {
      totalApplications: makeMetricDelta(
        current.totalApplications,
        previous?.totalApplications ??
          synthesizePreviousValue(current.totalApplications)
      ),
      sentCount: makeMetricDelta(
        current.sentCount,
        previous?.sentCount ?? synthesizePreviousValue(current.sentCount)
      ),
      responseRate: makeMetricDelta(
        current.responseRate * 100,
        (previous?.responseRate ??
          synthesizePreviousRate(current.responseRate)) * 100
      ),
      avgResponseDays: makeMetricDelta(
        current.avgResponseDays ?? 0,
        previous?.avgResponseDays ??
          synthesizePreviousValue(current.avgResponseDays ?? 0)
      ),
      activeCount: makeMetricDelta(
        current.activeCount,
        previous?.activeCount ?? synthesizePreviousValue(current.activeCount)
      ),
      interviewToOfferRate: makeMetricDelta(
        current.interviewToOfferRate == null
          ? 0
          : current.interviewToOfferRate * 100,
        previous?.interviewToOfferRate == null
          ? 0
          : previous.interviewToOfferRate * 100
      ),
    };
  });

  applicationsTrend = computed(() =>
    buildTrendSeries('applications', this.summary(), this.selectedPreset())
  );
  responseRateTrend = computed(() =>
    buildTrendSeries('responseRate', this.summary(), this.selectedPreset())
  );
  interviewTrend = computed(() =>
    buildTrendSeries('interviewToOffer', this.summary(), this.selectedPreset())
  );
  rejectionTrend = computed(() =>
    buildTrendSeries('rejections', this.summary(), this.selectedPreset())
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

    // If a "View Details" click on the applications page stashed an id
    // right before navigating here, consume it now and jump straight to
    // that application's timeline entry.
    const pendingId = this.pendingSelection.consumePendingAppId();
    if (pendingId != null) {
      this.onSelectApplication(pendingId);
    }
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
          const previousRange = getPreviousRange(range);
          this.summary.set(summary);
          this.previousSummary.set(
            buildSyntheticPreviousSummary(summary, previousRange)
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
        next: (events) => {
          this.applicationTimeline.set(this.withDaysSincePrevious(events));
          this.scrollToTimeline();
        },
        error: () => this.loadError.set(true),
      });
  }

  /**
   * Scrolls to the timeline section only after its content has actually
   * rendered. A blind setTimeout fires before the page has grown to its
   * final height (e.g. while applications/timeline are still loading),
   * so scrollIntoView ends up short of the target. Waiting two animation
   * frames lets Angular finish painting the new DOM first.
   */
  private scrollToTimeline(): void {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = document.getElementById('timeline-section');
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
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
}
