import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CvVariantsService } from '../../../services/cv-variants.service';
import { CvVariantDto, Page } from '../../../models';
import { CvPopupComponent } from '../cv-popup/cv-popup.component';
import { DeletePopupComponent } from '../../common/delete-popup/delete-popup.component';
import { PaginationComponent } from '../../common/pagination/pagination.component';
import { CvFiltersBarComponent } from '../cv-filters-bar/cv-filters-bar.component';
import {
  CvTableComponent,
  CvSortableColumn,
} from '../cv-table/cv-table.component';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { SkeletonComponent } from '../../common/skeleton/skeleton.components';
import { ToastService } from '../../common/toast/toast.service';
import { ToastContainerComponent } from '../../common/toast/toast-container.component';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { TourService } from 'src/app/services/tour.service';
import { getCvVariantsSteps } from 'src/app/services/toursteps';

@Component({
  selector: 'app-cv-variants',
  standalone: true,
  imports: [
    CommonModule,
    PaginationComponent,
    CvPopupComponent,
    DeletePopupComponent,
    CvFiltersBarComponent,
    CvTableComponent,
    ToastContainerComponent,
    SkeletonComponent,
    MatIconModule,
  ],
  templateUrl: './cv-variants.component.html',
})
export class CvVariantsComponent implements OnInit, OnDestroy {
  cvPage?: Page<CvVariantDto>;

  selectedLanguage = '';
  searchQuery = '';
  currentPage = 0;
  pageSize = 10;
  sortBy = 'id';
  direction: 'asc' | 'desc' = 'asc';

  // Only the very first load shows the full skeleton. Every later load
  // (search, filter, sort, page change) keeps the table mounted and just
  // dims it, so the list doesn't blink out from under the person.
  private hasLoadedOnce = false;
  isListLoading = false;
  isRefetching = false;
  isSubmitting = false;
  isDeleting = false;

  errorMessage = '';

  isModalOpen = false;
  isEditing = false;
  currentFormId?: number;

  formModel: Omit<CvVariantDto, 'id' | 'userId' | 'createdAt'> = {
    name: '',
    language: 'en',
    fileUrl: '',
  };

  showDeleteModal = false;
  deleteTargetId?: number;
  deleteMessage =
    'Are you sure you want to delete this track profile record permanently?';

  private searchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();

  constructor(
    private cvService: CvVariantsService,
    private toastService: ToastService,
    private tourService: TourService,
    private router: Router
  ) {}
  ngAfterViewInit(): void {
    this.tourService.run(getCvVariantsSteps(this.tourService, this.router));
  }

  ngOnInit(): void {
    this.searchSubject
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => {
        this.currentPage = 0;
        this.loadCvVariants();
      });

    this.loadCvVariants();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get hasActiveFilters(): boolean {
    return !!this.selectedLanguage || !!this.searchQuery.trim();
  }

  get resultsLabel(): string {
    const page = this.cvPage;
    if (!page) return '';

    const count = page.content?.length ?? 0;
    if (count === 0) return '';

    const totalPages = page.totalPages ?? 0;
    const pageInfo =
      totalPages > 1 ? ` · page ${this.currentPage + 1} of ${totalPages}` : '';

    return `${count} result${count === 1 ? '' : 's'}${pageInfo}`;
  }

  loadCvVariants(): void {
    if (!this.hasLoadedOnce) {
      this.isListLoading = true;
    } else {
      this.isRefetching = true;
    }
    this.errorMessage = '';

    this.cvService
      .getAllCvVariants(
        this.currentPage,
        this.pageSize,
        this.sortBy,
        this.direction,
        this.selectedLanguage || undefined,
        this.searchQuery.trim() || undefined
      )
      .subscribe({
        next: (page) => {
          // If a delete emptied the page we're viewing (or a filter change
          // did), step back one page and re-fetch rather than showing a
          // blank list. Guarded on currentPage > 0 so a genuinely empty
          // result set at page 0 still renders the empty state normally.
          if ((page.content?.length ?? 0) === 0 && this.currentPage > 0) {
            this.currentPage -= 1;
            this.isListLoading = false;
            this.isRefetching = false;
            this.loadCvVariants();
            return;
          }

          this.cvPage = page;
          this.hasLoadedOnce = true;
          this.isListLoading = false;
          this.isRefetching = false;
        },
        error: (err) => {
          this.errorMessage = err.error?.message ?? 'Failed to load your CVs.';
          this.isListLoading = false;
          this.isRefetching = false;
        },
      });
  }
  onSearchChange(query: string): void {
    this.searchQuery = query;
    this.searchSubject.next(query);
  }

  onLanguageFilterChange(lang: string): void {
    this.selectedLanguage = lang;
    this.currentPage = 0;
    this.loadCvVariants();
  }

  onSortChange(column: CvSortableColumn): void {
    if (this.sortBy === column) {
      this.direction = this.direction === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortBy = column;
      this.direction = 'asc';
    }
    this.currentPage = 0;
    this.loadCvVariants();
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.loadCvVariants();
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.currentPage = 0;
    this.loadCvVariants();
  }

  clearAllFilters(): void {
    this.selectedLanguage = '';
    this.searchQuery = '';
    this.currentPage = 0;
    this.loadCvVariants();
  }

  dismissError(): void {
    this.errorMessage = '';
  }

  openCreateModal(): void {
    this.isEditing = false;
    this.currentFormId = undefined;
    this.formModel = { name: '', language: 'en', fileUrl: '' };
    this.isModalOpen = true;
  }

  openEditModal(cv: CvVariantDto): void {
    if (!cv.id) return;
    this.isEditing = true;
    this.currentFormId = cv.id;
    this.formModel = {
      name: cv.name,
      language: cv.language,
      fileUrl: cv.fileUrl,
    };
    this.isModalOpen = true;
  }

  closeModal(): void {
    this.isModalOpen = false;
  }

  onSubmit(): void {
    this.isSubmitting = true;
    const request$ =
      this.isEditing && this.currentFormId
        ? this.cvService.updateCvVariant(this.currentFormId, this.formModel)
        : this.cvService.createCvVariant(this.formModel);

    request$.subscribe({
      next: () => {
        this.toastService.success(
          this.isEditing ? 'CV updated successfully.' : 'CV added successfully.'
        );
        this.isSubmitting = false;
        this.closeModal();
        this.loadCvVariants();
      },
      error: (err) => {
        this.toastService.error(
          err.error?.message ??
            'an unexpected error occurred, please try again.'
        );
        this.isSubmitting = false;
      },
    });
  }

  onDelete(cv: CvVariantDto): void {
    if (!cv.id) return;
    this.deleteTargetId = cv.id;
    this.deleteMessage = `Are you sure you want to permanently delete "${cv.name}"? This cannot be undone.`;
    this.showDeleteModal = true;
  }

  onConfirmDelete(): void {
    const id = this.deleteTargetId;
    if (!id) return;
    this.showDeleteModal = false;
    this.isDeleting = true;

    this.cvService.deleteCvVariant(id).subscribe({
      next: () => {
        this.toastService.success('CV deleted successfully.');
        this.isDeleting = false;
        this.loadCvVariants();
      },
      error: (err) => {
        this.toastService.error(err.error?.message ?? 'Failed to delete CV.');
        this.isDeleting = false;
      },
    });
  }

  onCancelDelete(): void {
    this.showDeleteModal = false;
    this.deleteTargetId = undefined;
    this.deleteMessage = 'Are you sure you want to delete this CV permanently?';
  }
}
