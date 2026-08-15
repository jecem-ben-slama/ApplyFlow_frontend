import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApplicationStatus } from '../../../services/stats.service';
import { ApplicationSummaryDto } from '../../../services/analytics.service';
import {
  KANBAN_COLUMN_CAP,
  STATUS_COLORS,
  STATUS_LABELS,
  STATUS_ORDER,
} from 'src/app/models/analytics-dashboard.model';

@Component({
  selector: 'app-application-board',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './application-board.component.html',
})
export class ApplicationBoardComponent {
  @Input() applications: ApplicationSummaryDto[] = [];
  @Input() loading = false;

  /** Emits the id of the card that was clicked, so the parent can select it. */
  @Output() cardSelected = new EventEmitter<number>();

  readonly statusOrder = STATUS_ORDER;
  readonly cap = KANBAN_COLUMN_CAP;

  column(status: ApplicationStatus): ApplicationSummaryDto[] {
    return this.applications.filter((app) => app.status === status);
  }

  columnCapped(status: ApplicationStatus): ApplicationSummaryDto[] {
    return this.column(status).slice(0, this.cap);
  }

  label(status: ApplicationStatus): string {
    return STATUS_LABELS[status];
  }

  colorClass(status: ApplicationStatus): string {
    return STATUS_COLORS[status];
  }

  trackByApp(_index: number, app: ApplicationSummaryDto): number {
    return app.id;
  }
}
