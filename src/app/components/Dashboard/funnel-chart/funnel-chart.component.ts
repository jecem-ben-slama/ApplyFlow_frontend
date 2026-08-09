import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DisplayFunnelStage } from 'src/app/models/analytics-dashboard.model';

@Component({
  selector: 'app-funnel-chart',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './funnel-chart.component.html',
})
export class FunnelChartComponent {
  @Input() stages: DisplayFunnelStage[] = [];
  @Input() loading = false;

  trackByStatus(_index: number, stage: DisplayFunnelStage): string {
    return stage.status;
  }
}
