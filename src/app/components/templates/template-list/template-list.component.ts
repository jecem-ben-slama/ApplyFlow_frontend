import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { TemplateFilterComponent } from '../template-filter/template-filter.component';
import { PaginationComponent } from '../../common/pagination/pagination.component';
import { TemplateComponent } from '../templates-view/templates.component';
import { StatMetricDto } from 'src/app/models/statsmetric.model';

@Component({
  selector: 'app-template-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    PaginationComponent,
    TemplateFilterComponent,
  ],
  templateUrl: './template-list.component.html',
})
export class TemplateListComponent {
  @Input() templates: TemplateComponent[] = [];
  @Input() totalElements = 0;
  @Input() currentPage = 0;
  @Input() totalPages = 0;
  @Input() loading = false;
  @Input() selectedLanguage: string | undefined = undefined;
  @Input() searchTerm = '';
  @Input() editingId: number | null = null;

  // Template performance stats, keyed by template name (StatMetricDto.categoryName)
  @Input() templateStats: { [categoryName: string]: StatMetricDto } = {};

  @Output() filterChange = new EventEmitter<string>();
  @Output() searchChange = new EventEmitter<string>();
  @Output() pageChange = new EventEmitter<number>();
  @Output() edit = new EventEmitter<TemplateComponent>();
  @Output() delete = new EventEmitter<number | undefined>();
  @Output() clearFilters = new EventEmitter<void>();
  @Output() createFirst = new EventEmitter<void>();

  private readonly avatarPalette = [
    '#6366F1', // indigo
    '#EC4899', // pink
    '#10B981', // emerald
    '#F59E0B', // amber
    '#3B82F6', // blue
    '#EF4444', // red
    '#8B5CF6', // violet
    '#14B8A6', // teal
  ];

  trackByTemplateId(
    index: number,
    tmpl: TemplateComponent
  ): number | undefined {
    return tmpl.id;
  }

  toggleExpand(tmpl: TemplateComponent): void {
    tmpl.isExpanded = !tmpl.isExpanded;
  }

  /** First 1-2 letters of the template name, for the Gmail-style avatar circle. */
  initials(name: string): string {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) {
      return parts[0].substring(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  /** Deterministic color per name so the same template always gets the same avatar color. */
  avatarColor(name: string): string {
    if (!name) return this.avatarPalette[0];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % this.avatarPalette.length;
    return this.avatarPalette[index];
  }

  /** Looks up the performance stat for a template by name. Returns undefined if no data yet. */
  getStat(tmpl: TemplateComponent): StatMetricDto | undefined {
    return this.templateStats?.[tmpl.name];
  }

  /** Rounded success rate percentage for display, or null if no data. */
  getSuccessRate(tmpl: TemplateComponent): number | null {
    const stat = this.getStat(tmpl);
    return stat ? Math.round(stat.successRatePercentage) : null;
  }

  /** Tailwind badge classes color-coded by success rate. */
  successRateClasses(rate: number | null): string {
    if (rate === null) {
      return 'bg-slate-100 text-slate-400 border-slate-200 dark:bg-surface-muted/40 dark:text-slate-500 dark:border-surface-muted';
    }
    if (rate >= 70) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900';
    }
    if (rate >= 40) {
      return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900';
    }
    return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900';
  }
}
