import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StatMetricDto } from '../../../models/statsmetric.model';
import { MIN_SAMPLE_SIZE } from 'src/app/models/analytics-dashboard.model';

@Component({
  selector: 'app-performance-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './performance-card.component.html',
})
export class PerformanceCardComponent {
  @Input() title = '';
  @Input() accentClass = 'bg-zinc-400';
  @Input() stats: StatMetricDto[] = [];
  @Input() loading = false;
  @Input() emptyMessage = 'No data available.';
  @Input() uppercaseLabels = false;

  sortedStats(): StatMetricDto[] {
    return [...this.stats].sort((a, b) => {
      if (b.successRatePercentage !== a.successRatePercentage) {
        return b.successRatePercentage - a.successRatePercentage;
      }
      return b.totalApplications - a.totalApplications;
    });
  }

  isLowSample(stat: StatMetricDto): boolean {
    return stat.totalApplications < MIN_SAMPLE_SIZE;
  }

  getRank(index: number): number {
    return index + 1;
  }

  trackByCategory(_index: number, stat: StatMetricDto): string {
    return stat.categoryName;
  }
}
