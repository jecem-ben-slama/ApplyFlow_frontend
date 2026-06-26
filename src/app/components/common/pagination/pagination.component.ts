import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-pagination',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      *ngIf="totalPages > 1"
      class="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 mt-4 pt-4 gap-3 flex-wrap"
    >
      <button
        (click)="onPageClick(currentPage - 1)"
        [disabled]="currentPage === 0 || loading"
        class="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        ‹ Previous
      </button>

      <div class="flex items-center gap-1 flex-wrap justify-center">
        <ng-container *ngFor="let p of pages">
          <ng-container
            *ngIf="
              p === 0 ||
                p === totalPages - 1 ||
                (p >= currentPage - 2 && p <= currentPage + 2);
              else ellipsis
            "
          >
            <button
              (click)="onPageClick(p)"
              [disabled]="loading"
              [ngClass]="
                p === currentPage
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-200 dark:hover:bg-slate-800'
              "
              class="w-7 h-7 rounded-md border text-[11px] font-mono font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {{ p + 1 }}
            </button>
          </ng-container>
          <ng-template #ellipsis>
            <span
              *ngIf="p === currentPage - 3 || p === currentPage + 3"
              class="text-slate-400 text-[11px] px-0.5 select-none"
              >…</span
            >
          </ng-template>
        </ng-container>
      </div>

      <button
        (click)="onPageClick(currentPage + 1)"
        [disabled]="currentPage >= totalPages - 1 || loading"
        class="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        Next ›
      </button>
    </div>
  `,
})
export class PaginationComponent {
  @Input() currentPage = 0;
  @Input() totalPages = 0;
  @Input() loading = false;
  @Output() pageChange = new EventEmitter<number>();

  get pages(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i);
  }

  onPageClick(page: number): void {
    if (page < 0 || page >= this.totalPages || page === this.currentPage) {
      return;
    }
    this.pageChange.emit(page);
  }
}
