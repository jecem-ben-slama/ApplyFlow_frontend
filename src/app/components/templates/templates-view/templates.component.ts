import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { trigger, style, transition, animate } from '@angular/animations';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { getPageMeta, Page, TemplateDto } from 'src/app/models';
import { TemplateService } from 'src/app/services/template.service';
import { DeletePopupComponent } from '../../common/delete-popup/delete-popup.component';
import {
  TemplateListComponent,
  TemplateSortColumn,
} from '../template-list/template-list.component';
import {
  TemplateFormComponent,
  TemplateData,
} from '../template-form/template-form.component';
import { SkeletonComponent } from '../../common/skeleton/skeleton.components';
import { ToastService } from '../../common/toast/toast.service';
import { ToastContainerComponent } from '../../common/toast/toast-container.component';
import { StatMetricDto } from 'src/app/models/statsmetric.model';
import { AnalyticsService } from 'src/app/services/analytics.service';
import { TourService } from 'src/app/services/tour.service';
import { Router } from '@angular/router';
import { getTemplatesSteps } from 'src/app/core/tour';

export interface TemplateComponent extends TemplateDto {
  isExpanded?: boolean;
}

@Component({
  selector: 'app-templates',
  standalone: true,
  imports: [
    CommonModule,
    DeletePopupComponent,
    TemplateListComponent,
    TemplateFormComponent,
    ToastContainerComponent,
  ],
  templateUrl: './templates.component.html',
  animations: [
    trigger('formSlide', [
      transition(':enter', [
        style({ opacity: 0, height: '0px', overflow: 'hidden' }),
        animate(
          '280ms cubic-bezier(0.4, 0, 0.2, 1)',
          style({ opacity: 1, height: '*' })
        ),
      ]),
      transition(':leave', [
        style({ opacity: 1, height: '*', overflow: 'hidden' }),
        animate(
          '220ms cubic-bezier(0.4, 0, 0.2, 1)',
          style({ opacity: 0, height: '0px' })
        ),
      ]),
    ]),
  ],
})
export class TemplatesComponent implements OnInit, OnDestroy {
  templates: TemplateComponent[] = [];
  loading = false;
  errorMessage = '';

  isFormVisible = false;
  editingTemplateId: number | null = null;

  subjectPlaceholder = 'e.g., Application Update: {{ positionName }}';

  currentPage = 0;
  pageSize = 10;
  totalPages = 0;
  totalElements = 0;
  selectedLanguage: string | undefined = undefined;
  searchTerm = '';

  // Sort state, owned here and passed down to app-template-list — same
  // pattern as currentPage/selectedLanguage above.
  sortBy: TemplateSortColumn = 'name';
  direction: 'asc' | 'desc' = 'asc';

  // Template performance stats, keyed by template name (StatMetricDto.categoryName)
  templateStats: { [categoryName: string]: StatMetricDto } = {};

  // RxJS Search Stream to prevent erratic layout flickering & double-firing
  private searchSubject = new Subject<string>();
  private searchSubscription!: Subscription;

  newTemplate: TemplateData = {
    name: '',
    language: 'EN',
    subjectTemplate: '',
    bodyTemplate: '',
  };

  showDeleteModal = false;
  deleteTargetId?: number;
  deleteMessage = 'Are you sure you want to drop this layout parsing template?';

  // ── Draft persistence ──
  constructor(
    private templateService: TemplateService,
    private analyticsService: AnalyticsService,
    private toastService: ToastService,
    private tourService: TourService,
    private router: Router
  ) {}
  ngAfterViewInit(): void {
    this.tourService.run(getTemplatesSteps(this.tourService, this.router));
  }

  ngOnInit(): void {
    this.adjustFormVisibilityForViewport();

    this.searchSubscription = this.searchSubject
      .pipe(debounceTime(350), distinctUntilChanged())
      .subscribe((term) => {
        this.searchTerm = term;
        this.currentPage = 0;
        this.loadTemplates(true); // Pass true for background loading to prevent UI flickering / focus loss
      });

    this.loadTemplates();
    this.loadTemplateStats();
  }

  ngOnDestroy(): void {
    if (this.searchSubscription) {
      this.searchSubscription.unsubscribe();
    }
  }

  adjustFormVisibilityForViewport(): void {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      this.isFormVisible = false;
    }
  }

  loadTemplates(isBackground: boolean = false): void {
    if (!isBackground) {
      this.loading = true;
    }

    this.templateService
      .getAllTemplates(
        this.currentPage,
        this.pageSize,
        this.sortBy,
        this.direction,
        this.selectedLanguage,
        this.searchTerm || undefined
      )
      .subscribe({
        next: (page: Page<TemplateDto>) => {
          // If a delete (or filter change) emptied the page we're viewing,
          // step back one page and re-fetch rather than showing a blank
          // list. Guarded on currentPage > 0 so a genuinely empty result
          // set at page 0 still renders the empty state normally.
          if ((page.content?.length ?? 0) === 0 && this.currentPage > 0) {
            this.currentPage -= 1;
            this.loading = false;
            this.loadTemplates(isBackground);
            return;
          }

          const meta = getPageMeta(page);
          this.templates = page.content.map((t) => ({
            ...t,
            isExpanded: false,
          }));
          this.currentPage = meta.number;
          this.totalPages = meta.totalPages;
          this.totalElements = meta.totalElements;
          this.loading = false;
        },
        error: (err) => {
          this.loading = false;
          this.toastService.error(
            err.error?.message ?? 'Failed to load templates. Please try again.'
          );
        },
      });
  }

  loadTemplateStats(): void {
    this.analyticsService.getTemplateStats().subscribe({
      next: (stats: StatMetricDto[]) => {
        const map: { [categoryName: string]: StatMetricDto } = {};
        stats.forEach((s) => (map[s.categoryName] = s));
        this.templateStats = map;
      },
      error: (err) => {
        this.toastService.error(
          err.error?.message ??
            'Failed to load template stats. Please try again.'
        );
      },
    });
  }

  onToggleForm(): void {
    this.isFormVisible = !this.isFormVisible;
  }

  scrollToForm(): void {
    this.isFormVisible = true;
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  updateSearchTerm(term: string): void {
    this.searchTerm = term; // Update value instantly for UI responsiveness
    this.searchSubject.next(term); // Push into debounced stream
  }

  onLanguageFilterChange(lang: string): void {
    this.selectedLanguage = lang === 'ALL' ? undefined : lang;
    this.currentPage = 0;
    this.loadTemplates();
  }

  onClearFilters(): void {
    this.searchTerm = '';
    this.selectedLanguage = undefined;
    this.currentPage = 0;
    this.loadTemplates();
  }

  onSortChange(column: TemplateSortColumn): void {
    if (this.sortBy === column) {
      this.direction = this.direction === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortBy = column;
      this.direction = 'asc';
    }
    this.currentPage = 0;
    this.loadTemplates();
  }

  onEditClick(template: TemplateDto): void {
    if (!template.id) return;
    this.editingTemplateId = template.id;
    this.isFormVisible = true;
    this.newTemplate = {
      name: template.name,
      language: template.language,
      subjectTemplate: template.subjectTemplate,
      bodyTemplate: template.bodyTemplate,
    };
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  onCancelEdit(): void {
    this.editingTemplateId = null;
    this.newTemplate = {
      name: '',
      language: 'EN',
      subjectTemplate: '',
      bodyTemplate: '',
    };
    this.isFormVisible = false;
  }

  onSubmitTemplate(data: TemplateData): void {
    this.loading = true;
    this.errorMessage = '';

    if (
      !data.name?.trim() ||
      !data.subjectTemplate?.trim() ||
      !data.bodyTemplate?.trim()
    ) {
      this.errorMessage = 'Please fill in all required fields.';
      this.loading = false;
      this.toastService.error(this.errorMessage);
      return;
    }

    this.newTemplate = data;

    if (this.editingTemplateId !== null) {
      this.templateService
        .updateTemplate(this.editingTemplateId, data)
        .subscribe({
          next: () => {
            this.onCancelEdit();
            this.loadTemplates();
            this.toastService.success('Template updated successfully.');
          },
          error: (err) => {
            this.loading = false;
            this.toastService.error(
              err.error?.message ??
                'Failed to update template. Please try again.'
            );
          },
        });
    } else {
      this.templateService.createTemplate(data).subscribe({
        next: () => {
          this.onCancelEdit();
          this.loadTemplates();
          this.toastService.success('Template created successfully.');
        },
        error: (err) => {
          this.loading = false;
          this.toastService.error(
            err.error?.message ?? 'Failed to create template. Please try again.'
          );
        },
      });
    }
  }

  onDeleteTemplate(id: number | undefined): void {
    if (!id) return;
    this.deleteTargetId = id;
    this.showDeleteModal = true;
  }

  onConfirmDelete(): void {
    const id = this.deleteTargetId;
    if (!id) return;
    this.showDeleteModal = false;
    if (this.editingTemplateId === id) this.onCancelEdit();

    this.templateService.deleteTemplate(id).subscribe({
      next: () => {
        this.loadTemplates();
        this.toastService.success('Template deleted successfully.');
      },
      error: (err) => {
        this.toastService.error(
          err.error?.message ?? 'Failed to delete template. Please try again.'
        );
      },
    });
  }

  onCancelDelete(): void {
    this.showDeleteModal = false;
    this.deleteTargetId = undefined;
  }

  onPageChange(newPage: number): void {
    this.currentPage = newPage;
    this.loadTemplates();
  }
}
