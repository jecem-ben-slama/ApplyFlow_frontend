import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApplicationStatus } from '../../../services/stats.service';
import { STATUS_LABELS } from 'src/app/models/analytics-dashboard.model';
import { STATUS_COLORS } from 'src/app/models/analytics-dashboard.model';
@Component({
  selector: 'app-outcomes-strip',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './outcomes-strip.component.html',
})
export class OutcomesStripComponent {
  @Input() statuses: ApplicationStatus[] = [];
  @Input() counts: Partial<Record<ApplicationStatus, number>> = {};

  label(status: ApplicationStatus): string {
    return STATUS_LABELS[status];
  }

  colorClass(status: ApplicationStatus): string {
    return STATUS_COLORS[status];
  }
}
