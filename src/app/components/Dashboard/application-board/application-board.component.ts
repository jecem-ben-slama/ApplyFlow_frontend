import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  CdkDragDrop,
  DragDropModule,
  moveItemInArray,
  transferArrayItem,
} from '@angular/cdk/drag-drop';
import { ApplicationStatus } from '../../../services/stats.service';
import { ApplicationSummaryDto } from '../../../services/analytics.service';
import {
  STATUS_COLORS,
  STATUS_LABELS,
  STATUS_ORDER,
} from 'src/app/models/analytics-dashboard.model';

export interface KanbanStatusChange {
  id: number;
  from: ApplicationStatus;
  to: ApplicationStatus;
}

@Component({
  selector: 'app-application-board',
  standalone: true,
  imports: [CommonModule, DragDropModule],
  templateUrl: './application-board.component.html',
})
export class ApplicationBoardComponent implements OnChanges {
  @Input() applications: ApplicationSummaryDto[] = [];
  @Input() loading = false;

  /** Emits the id of the card that was clicked, so the parent can select it. */
  @Output() cardSelected = new EventEmitter<number>();

  /**
   * Emits when a card is dropped into a different column. The card is
   * moved optimistically in the UI immediately on drop; the parent owns
   * persistence (PATCH to the backend) and should call `revert()` if that
   * call fails, to snap the card back to its original column.
   */
  @Output() statusChanged = new EventEmitter<KanbanStatusChange>();

  readonly statusOrder = STATUS_ORDER;

  /** Every column's drop list is connected to every other, so cards can move across columns. */
  readonly dropListIds = STATUS_ORDER.map((s) => this.dropListId(s));

  /**
   * Working copy of applications grouped by status, one array per column.
   * Rebuilt from @Input() applications whenever it changes, then mutated
   * in place by CDK drag/drop so columns update instantly as the user
   * drags, without waiting on a server round trip. Using stable array
   * references (rather than recomputing a filter on every change
   * detection pass) is what lets CDK track drag indices correctly.
   */
  columns: Record<ApplicationStatus, ApplicationSummaryDto[]> =
    this.emptyColumns();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['applications']) {
      this.columns = this.groupByStatus(this.applications);
    }
  }

  private emptyColumns(): Record<ApplicationStatus, ApplicationSummaryDto[]> {
    const cols = {} as Record<ApplicationStatus, ApplicationSummaryDto[]>;
    this.statusOrder.forEach((s) => (cols[s] = []));
    return cols;
  }

  private groupByStatus(
    apps: ApplicationSummaryDto[]
  ): Record<ApplicationStatus, ApplicationSummaryDto[]> {
    const cols = this.emptyColumns();
    for (const app of apps) {
      const status = app.status as ApplicationStatus;
      if (!cols[status]) cols[status] = [];
      cols[status].push(app);
    }
    return cols;
  }

  dropListId(status: ApplicationStatus): string {
    return `kanban-${status}`;
  }

  column(status: ApplicationStatus): ApplicationSummaryDto[] {
    return this.columns[status] ?? [];
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

  onDrop(
    event: CdkDragDrop<ApplicationSummaryDto[]>,
    toStatus: ApplicationStatus
  ): void {
    if (event.previousContainer === event.container) {
      // Reordering within the same column — cosmetic only, nothing to persist.
      moveItemInArray(
        event.container.data,
        event.previousIndex,
        event.currentIndex
      );
      return;
    }

    const fromStatus = this.statusOrder.find(
      (s) => this.columns[s] === event.previousContainer.data
    ) as ApplicationStatus;
    const app = event.previousContainer.data[event.previousIndex];

    transferArrayItem(
      event.previousContainer.data,
      event.container.data,
      event.previousIndex,
      event.currentIndex
    );

    this.statusChanged.emit({ id: app.id, from: fromStatus, to: toStatus });
  }

  /** Called by the parent if the backend PATCH fails, to snap a card back to its original column. */
  revert(change: KanbanStatusChange): void {
    const toCol = this.columns[change.to];
    const idx = toCol.findIndex((a) => a.id === change.id);
    if (idx === -1) return;
    const [app] = toCol.splice(idx, 1);
    this.columns[change.from].push(app);
  }
}
