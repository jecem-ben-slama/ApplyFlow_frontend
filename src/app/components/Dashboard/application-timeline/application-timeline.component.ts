import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApplicationSummaryDto } from '../../../services/analytics.service';
import { ApplicationStatus } from '../../../services/stats.service';
import {
  STATUS_COLORS,
  STATUS_LABELS,
  TimelineEventDisplay,
} from 'src/app/models/analytics-dashboard.model';

@Component({
  selector: 'app-application-timeline',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './application-timeline.component.html',
})
export class ApplicationTimelineComponent {
  @Input() applications: ApplicationSummaryDto[] = [];
  @Input() loadingApplications = false;
  @Input() selectedApplicationId: number | null = null;
  @Input() timeline: TimelineEventDisplay[] = [];
  @Input() loadingTimeline = false;

  @Output() applicationSelected = new EventEmitter<number | null>();

  onSelect(id: number | null): void {
    this.applicationSelected.emit(id);
  }

  label(status: ApplicationStatus): string {
    return STATUS_LABELS[status];
  }

  colorClass(status: ApplicationStatus): string {
    return STATUS_COLORS[status];
  }

  trackByEventId(_index: number, event: TimelineEventDisplay): number {
    return event.id;
  }
}
