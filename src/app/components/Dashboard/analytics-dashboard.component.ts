import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { AnalyticsService } from 'src/app/services/analytics.service';
import { StatMetricDto } from 'src/app/models/statsmetric.model';

@Component({
  selector: 'app-analytics-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="p-4 sm:p-6 lg:p-8 min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors duration-200"
    >
      <!-- Page Header -->
      <div class="mb-8">
        <h1 class="text-2xl sm:text-3xl font-bold tracking-tight">
          Application Performance CRM
        </h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Monitor conversion rates based on interview and offer statuses across
          your CV variants, languages, and job roles.
        </p>
      </div>

      <!-- Error banner -->
      <div
        *ngIf="loadError()"
        class="mb-6 text-sm px-4 py-3 rounded-lg bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900"
      >
        Couldn't load analytics data. Please try again shortly.
      </div>

      <!-- Responsive Grid Layout (1 col mobile, 3 cols large screen) -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- CV Variant Card -->
        <div
          class="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-5 flex flex-col justify-between"
        >
          <div>
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-base font-semibold">CV Variant Success</h2>
              <span
                class="text-xs px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-full font-medium"
                >CVs</span
              >
            </div>

            <div class="space-y-4">
              <ng-container *ngIf="loading(); else cvLoaded">
                <p class="text-sm text-gray-400 italic text-center py-8">
                  Loading…
                </p>
              </ng-container>

              <ng-template #cvLoaded>
                <ng-container *ngIf="cvStats().length; else noCvStats">
                  <div
                    *ngFor="let stat of cvStats(); trackBy: trackByCategory"
                    class="space-y-1.5"
                  >
                    <div class="flex justify-between text-sm">
                      <span
                        class="font-medium truncate max-w-[160px]"
                        [title]="stat.categoryName"
                        >{{ stat.categoryName }}</span
                      >
                      <span class="text-gray-500 dark:text-gray-400 text-xs"
                        >{{ stat.successRatePercentage }}% ({{
                          stat.successCount
                        }}/{{ stat.totalApplications }})</span
                      >
                    </div>
                    <div
                      class="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2 overflow-hidden"
                    >
                      <div
                        class="bg-indigo-600 h-2 rounded-full transition-all duration-500"
                        [style.width.%]="stat.successRatePercentage"
                      ></div>
                    </div>
                  </div>
                </ng-container>

                <ng-template #noCvStats>
                  <p class="text-sm text-gray-400 italic text-center py-8">
                    No CV performance data available.
                  </p>
                </ng-template>
              </ng-template>
            </div>
          </div>
        </div>

        <!-- Language Performance Card -->
        <div
          class="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-5 flex flex-col justify-between"
        >
          <div>
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-base font-semibold">Language Performance</h2>
              <span
                class="text-xs px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-full font-medium"
                >Localization</span
              >
            </div>

            <div class="space-y-4">
              <ng-container *ngIf="loading(); else langLoaded">
                <p class="text-sm text-gray-400 italic text-center py-8">
                  Loading…
                </p>
              </ng-container>

              <ng-template #langLoaded>
                <ng-container *ngIf="langStats().length; else noLangStats">
                  <div
                    *ngFor="let stat of langStats(); trackBy: trackByCategory"
                    class="space-y-1.5"
                  >
                    <div class="flex justify-between text-sm">
                      <span class="font-medium uppercase">{{
                        stat.categoryName
                      }}</span>
                      <span class="text-gray-500 dark:text-gray-400 text-xs"
                        >{{ stat.successRatePercentage }}% ({{
                          stat.successCount
                        }}/{{ stat.totalApplications }})</span
                      >
                    </div>
                    <div
                      class="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2 overflow-hidden"
                    >
                      <div
                        class="bg-emerald-600 h-2 rounded-full transition-all duration-500"
                        [style.width.%]="stat.successRatePercentage"
                      ></div>
                    </div>
                  </div>
                </ng-container>

                <ng-template #noLangStats>
                  <p class="text-sm text-gray-400 italic text-center py-8">
                    No language performance data available.
                  </p>
                </ng-template>
              </ng-template>
            </div>
          </div>
        </div>

        <!-- Job Post Performance Card -->
        <div
          class="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-5 flex flex-col justify-between"
        >
          <div>
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-base font-semibold">Job Role Success</h2>
              <span
                class="text-xs px-2.5 py-1 bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 rounded-full font-medium"
                >Positions</span
              >
            </div>

            <div class="space-y-4">
              <ng-container *ngIf="loading(); else jobLoaded">
                <p class="text-sm text-gray-400 italic text-center py-8">
                  Loading…
                </p>
              </ng-container>

              <ng-template #jobLoaded>
                <ng-container *ngIf="jobStats().length; else noJobStats">
                  <div
                    *ngFor="let stat of jobStats(); trackBy: trackByCategory"
                    class="space-y-1.5"
                  >
                    <div class="flex justify-between text-sm">
                      <span
                        class="font-medium truncate max-w-[160px]"
                        [title]="stat.categoryName"
                        >{{ stat.categoryName }}</span
                      >
                      <span class="text-gray-500 dark:text-gray-400 text-xs"
                        >{{ stat.successRatePercentage }}% ({{
                          stat.successCount
                        }}/{{ stat.totalApplications }})</span
                      >
                    </div>
                    <div
                      class="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2 overflow-hidden"
                    >
                      <div
                        class="bg-amber-600 h-2 rounded-full transition-all duration-500"
                        [style.width.%]="stat.successRatePercentage"
                      ></div>
                    </div>
                  </div>
                </ng-container>

                <ng-template #noJobStats>
                  <p class="text-sm text-gray-400 italic text-center py-8">
                    No job title performance data available.
                  </p>
                </ng-template>
              </ng-template>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class AnalyticsDashboardComponent implements OnInit {
  private analyticsService = inject(AnalyticsService);
  private destroyRef = inject(DestroyRef);

  cvStats = signal<StatMetricDto[]>([]);
  langStats = signal<StatMetricDto[]>([]);
  jobStats = signal<StatMetricDto[]>([]);
  loading = signal(true);
  loadError = signal(false);

  ngOnInit(): void {
    forkJoin({
      cv: this.analyticsService.getCvStats(),
      lang: this.analyticsService.getLanguageStats(),
      job: this.analyticsService.getJobStats(),
    })
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: ({ cv, lang, job }) => {
          this.cvStats.set(cv);
          this.langStats.set(lang);
          this.jobStats.set(job);
        },
        error: () => this.loadError.set(true),
      });
  }

  trackByCategory(_index: number, stat: StatMetricDto): string {
    return stat.categoryName;
  }
}
