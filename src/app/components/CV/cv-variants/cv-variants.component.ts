import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CvVariantsService } from '../../../services/cv-variants.service';
import { CvVariantDto, Page } from '../../../models';
import { CvPopupComponent } from '../cv-popup/cv-popup.component';
import { DeletePopupComponent } from '../../common/delete-popup/delete-popup.component';
import { PaginationComponent } from '../../common/pagination/pagination.component';
import { CvFiltersBarComponent } from '../cv-filters-bar/cv-filters-bar.component';
import { CvTableComponent } from '../cv-table/cv-table.component';
import { CvFeedbackComponent } from '../cv-feedback/cv-feedback.component';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';

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
    CvFeedbackComponent,
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

  isLoading = false;
  errorMessage = '';
  successMessage = '';

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

  constructor(private cvService: CvVariantsService) {}

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

  loadCvVariants(): void {
    this.isLoading = true;
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
          this.cvPage = page;
          this.isLoading = false;
        },
        error: (err) => {
          this.errorMessage =
            err.error?.message ??
            'Failed to populate CV directory pipeline profiles.';
          this.isLoading = false;
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

  onPageChange(page: number): void {
    this.currentPage = page;
    this.loadCvVariants();
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.currentPage = 0;
    this.loadCvVariants();
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
    this.isLoading = true;
    const request$ =
      this.isEditing && this.currentFormId
        ? this.cvService.updateCvVariant(this.currentFormId, this.formModel)
        : this.cvService.createCvVariant(this.formModel);

    request$.subscribe({
      next: () => {
        this.showFeedback(
          this.isEditing
            ? 'CV Profile adjusted.'
            : 'CV Profile cataloged successfully.'
        );
        this.closeModal();
        this.loadCvVariants();
      },
      error: (err) => {
        this.errorMessage =
          err.error?.message ??
          'Transaction error on model mutation processing.';
        this.isLoading = false;
      },
    });
  }

  onDelete(id: number | undefined): void {
    if (!id) return;
    this.deleteTargetId = id;
    this.showDeleteModal = true;
  }

  onConfirmDelete(): void {
    const id = this.deleteTargetId;
    if (!id) return;
    this.showDeleteModal = false;
    this.isLoading = true;

    this.cvService.deleteCvVariant(id).subscribe({
      next: () => {
        this.showFeedback('CV track sequence removed.');
        this.loadCvVariants();
      },
      error: (err) => {
        this.errorMessage =
          err.error?.message ?? 'Failed to discard record parameters.';
        this.isLoading = false;
      },
    });
  }

  onCancelDelete(): void {
    this.showDeleteModal = false;
    this.deleteTargetId = undefined;
  }

  private showFeedback(msg: string): void {
    this.successMessage = msg;
    setTimeout(() => (this.successMessage = ''), 4000);
  }
}
