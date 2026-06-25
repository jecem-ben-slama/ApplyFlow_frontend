import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { CvVariantsService } from '../../../services/cv-variants.service';
import { CvVariantDto, Page } from '../../../models';
import { PaginationComponent } from '../../pagination/pagination.component';
import { CvPopupComponent } from '../cv-popup/cv-popup.component';

@Component({
  selector: 'app-cv-variants',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    PaginationComponent,
    CvPopupComponent,
  ],
  templateUrl: './cv-variants.component.html',
  styleUrls: ['./cv-variants.component.css'],
})
export class CvVariantsComponent implements OnInit {
  // Main Data Store
  cvPage?: Page<CvVariantDto>;

  // Query Filters & Pagination State
  selectedLanguage: string = '';
  currentPage: number = 0;
  pageSize: number = 10;
  sortBy: string = 'id';
  direction: 'asc' | 'desc' = 'asc';

  // UX & Async State trackers
  isLoading = false;
  errorMessage = '';
  successMessage = '';

  // Form State Management
  isModalOpen = false;
  isEditing = false;
  currentFormId?: number;

  // Form Model
  formModel: Omit<CvVariantDto, 'id' | 'userId' | 'createdAt'> = {
    name: '',
    language: 'en',
    fileUrl: '',
  };

  constructor(private cvService: CvVariantsService) {}

  ngOnInit(): void {
    this.loadCvVariants();
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
        this.selectedLanguage || undefined
      )
      .subscribe({
        next: (page) => {
          this.cvPage = page;
          this.isLoading = false;
        },
        error: (err) => {
          this.errorMessage =
            err.error?.message ||
            'Failed to populate CV directory pipeline profiles.';
          this.isLoading = false;
        },
      });
  }

  onLanguageFilterChange(): void {
    this.currentPage = 0;
    this.loadCvVariants();
  }

  onPageChange(newPage: number): void {
    this.currentPage = newPage;
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
          err.error?.message ||
          'Transaction error on model mutation processing.';
        this.isLoading = false;
      },
    });
  }

  onDelete(id: number | undefined): void {
    if (
      !id ||
      !confirm(
        'Are you sure you want to delete this track profile record permanently?'
      )
    )
      return;

    this.isLoading = true;
    this.cvService.deleteCvVariant(id).subscribe({
      next: () => {
        this.showFeedback('CV track sequence removed.');
        this.loadCvVariants();
      },
      error: (err) => {
        this.errorMessage =
          err.error?.message || 'Failed to discard record parameters.';
        this.isLoading = false;
      },
    });
  }

  private showFeedback(msg: string): void {
    this.successMessage = msg;
    setTimeout(() => (this.successMessage = ''), 4000);
  }
}
