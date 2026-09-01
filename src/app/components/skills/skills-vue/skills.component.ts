// skills.component.ts
import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { DeletePopupComponent } from '../../common/delete-popup/delete-popup.component';
import { Skill, Category, getPageMeta } from 'src/app/models';
import { CategoryService } from 'src/app/services/category.service';
import { SkillsService } from 'src/app/services/skills.service';
import { CategoryListComponent } from '../category-list/category-list.component';
import { CategoryPopupComponent } from '../category-popup/category-popup.component';
import { SkillTableComponent } from '../skill-table/skill-table.component';
import { SkillFormComponent } from '../skills-form/skill-form.component';
import { SkeletonComponent } from '../../common/skeleton/skeleton.components';
import { ToastContainerComponent } from '../../common/toast/toast-container.component';
import { ToastService } from '../../common/toast/toast.service';
import { Router } from '@angular/router';
import { TourService } from 'src/app/services/tour.service';
import { getSkillsSteps } from 'src/app/services/toursteps';

@Component({
  selector: 'app-skills',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    SkillFormComponent,
    CategoryListComponent,
    SkillTableComponent,
    DeletePopupComponent,
    CategoryPopupComponent,
    SkeletonComponent,
    MatIconModule,
    ToastContainerComponent,
  ],
  templateUrl: './skills.component.html',
})
export class SkillsComponent implements OnInit {
  @ViewChild('skillForm', { read: ElementRef }) skillFormRef?: ElementRef;

  skills: Skill[] = [];
  categories: Category[] = [];

  loading = false;
  initialLoading = true; // true only until the first fetch completes; controls the data/table skeleton
  errorMessage = '';

  // NEW: server-side error scoped to the skill-form specifically, distinct
  // from the page-level `errorMessage` above (which also covers category
  // load/delete failures unrelated to the form). Bind this to
  // <app-skill-form [errorMessage]="skillFormError" ...> in skills.component.html,
  // and add a matching `@Input() errorMessage = '';` to SkillFormComponent
  // that ORs into its existing internal `errorMessage` display (client-side
  // validation errors should still show even when this is empty). Without
  // this, a rejected save from the API never reaches the form's own error
  // banner — it only ever showed up as a toast, which means
  // `#tour-skill-error` (the tour's failure selector) would never fire for
  // a genuine server-side rejection, only for a client-validation failure
  // that gateNextOnValid should already be blocking upstream.
  skillFormError = '';

  editingSkillId: number | null = null;
  isFormExpanded = false; // Tracks whether edit action forces form expansion
  currentPage = 0;
  pageSize = 8;
  totalPages = 0;
  totalElements = 0;

  selectedFilterCategoryId: number | null = null;
  searchTerm = '';
  searchInputValue = '';
  isSearching = false;

  // Added Debounce property
  private privateDebounce: ReturnType<typeof setTimeout> | null = null;

  // Guards against starting the tour more than once (e.g. if loadSkills()
  // is re-triggered by a filter/page change after the initial load).
  private tourStarted = false;

  newSkillData = {
    name: '',
    sentenceEn: '',
    sentenceFr: '',
    categoryId: null as number | null,
  };

  // Modals
  showDeleteModal = false;
  deleteTargetId?: number;
  deleteTargetType: 'skill' | 'category' = 'skill';
  deleteMessage = '';

  showCategoryModal = false;
  editingCategory: Category | null = null;
  categoryPopupName = '';
  categoryPopupError = '';
  categoryPopupLoading = false;

  constructor(
    private skillsService: SkillsService,
    private categoryService: CategoryService,
    private toastService: ToastService,
    private tourService: TourService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadCategories();
    this.loadSkills();
  }

  // Used by the active-filters bar to show which category the search is scoped to
  get selectedCategoryName(): string | null {
    return (
      this.categories.find((c) => c.id === this.selectedFilterCategoryId)
        ?.name ?? null
    );
  }

  get hasActiveFilters(): boolean {
    return !!this.searchTerm || this.selectedFilterCategoryId !== null;
  }

  loadCategories(): void {
    this.categoryService.getAllCategories().subscribe({
      next: (cats) => (this.categories = cats),
      error: (err) => {
        this.errorMessage =
          err.error.message ||
          'Could not load categories. Please refresh the page.';
        this.toastService.error(this.errorMessage);
      },
    });
  }

  loadSkills(): void {
    this.loading = true;
    this.skills = [];
    this.skillsService
      .getAllSkills(
        this.currentPage,
        this.pageSize,
        'id',
        'asc',
        this.selectedFilterCategoryId,
        this.searchTerm || undefined
      )
      .subscribe({
        next: (page) => {
          const meta = getPageMeta(page);

          // If a delete (a single skill, or a category-cascade that took
          // several skills with it) emptied the page we're viewing, step
          // back one page and re-fetch rather than showing a blank list.
          // meta.totalElements > 0 keeps a genuinely empty result set
          // (no skills at all, or none matching the filter) rendering
          // the normal empty state instead of looping.
          if (
            meta.totalElements > 0 &&
            page.content.length === 0 &&
            this.currentPage > 0
          ) {
            this.currentPage--;
            this.loading = false;
            this.loadSkills();
            return;
          }

          this.skills = page.content;
          this.totalPages = meta.totalPages;
          this.totalElements = meta.totalElements;
          this.loading = false;
          this.isSearching = false;
          this.initialLoading = false;

          this.maybeStartTour();
        },
        error: (err) => {
          this.errorMessage =
            err.error.message || 'Could not load skills. Please try again.';
          this.toastService.error(this.errorMessage), (this.loading = false);
          this.isSearching = false;
          this.initialLoading = false;
          // Deliberately not starting the tour here — nothing rendered to highlight.
        },
      });
  }

  /**
   * Starts the onboarding tour exactly once, and only after the first
   * successful load has flipped initialLoading to false. The setTimeout(0)
   * defers to the next macrotask so Angular's change-detection pass (which
   * renders <app-category-list> and every #tour-* element inside it) has
   * fully completed before Driver.js queries and highlights anything.
   * A microtask (Promise.resolve().then) is NOT sufficient here — it can
   * still run before the DOM update within the same zone flush.
   */
  private maybeStartTour(): void {
    if (this.tourStarted) return;
    this.tourStarted = true;
    setTimeout(() => {
      this.tourService.run(getSkillsSteps(this.tourService, this.router));
    }, 0);
  }

  dismissError(): void {
    this.errorMessage = '';
  }

  // --- Handlers for Skill Form ---
  onSaveSkill(formData: any): void {
    this.loading = true;
    this.errorMessage = '';
    this.skillFormError = ''; // clear any stale error from a previous failed attempt
    if (this.editingSkillId !== null) {
      this.skillsService.updateSkill(this.editingSkillId, formData).subscribe({
        next: () => {
          this.resetForm();
          this.loadSkills();
          this.isFormExpanded = false;
          this.toastService.success('Skill updated successfully');
        },
        error: (err) => {
          const message =
            err.error?.message || 'Failed to update skill. Please try again.';
          this.errorMessage = message;
          this.skillFormError = message; // NEW: surface it in the form's own banner too
          this.toastService.error(this.errorMessage);
          this.loading = false;
          // isFormExpanded is deliberately left untouched here — the form
          // must stay open on failure so the tour (and the user) can see
          // the error and retry.
        },
      });
    } else {
      this.skillsService.createSkill(formData).subscribe({
        next: () => {
          this.resetForm();
          this.isFormExpanded = false;
          this.toastService.success('Skill added successfully');
          this.skillsService
            .getAllSkills(
              0,
              this.pageSize,
              'id',
              'asc',
              this.selectedFilterCategoryId
            )
            .subscribe((peek) => {
              this.currentPage = Math.max(0, getPageMeta(peek).totalPages - 1);
              this.loadSkills();
              this.isFormExpanded = false;
            });
        },
        error: (err) => {
          const message =
            err.error?.message || 'Failed to create skill. Please try again.';
          this.errorMessage = message;
          this.skillFormError = message; // NEW
          this.loading = false;
          this.toastService.error(this.errorMessage);
        },
      });
    }
  }

  onEditSkillClicked(skill: Skill): void {
    this.editingSkillId = skill.id;
    this.isFormExpanded = true;
    this.skillFormError = ''; // clear any leftover error from a previous attempt
    this.newSkillData = {
      name: skill.name || '',
      sentenceEn: skill.sentenceEn || '',
      sentenceFr: skill.sentenceFr || '',
      categoryId: skill.categoryId ?? null,
    };

    this.skillFormRef?.nativeElement.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }

  resetForm(): void {
    this.editingSkillId = null;
    this.skillFormError = '';

    this.newSkillData = {
      name: '',
      sentenceEn: '',
      sentenceFr: '',
      categoryId: null,
    };
  }

  // --- Handlers for Category List ---
  onFilterChange(catId: number | null): void {
    this.selectedFilterCategoryId = catId;
    this.currentPage = 0;
    this.loadSkills();
  }

  openAddCategoryModal(): void {
    this.editingCategory = null;
    this.categoryPopupName = '';
    this.categoryPopupError = '';
    this.showCategoryModal = true;
  }

  onEditCategoryClicked(cat: Category): void {
    this.editingCategory = cat;
    this.categoryPopupName = cat.name;
    this.showCategoryModal = true;
  }

  onDeleteCategoryClicked(data: {
    category: Category;
    event: MouseEvent;
  }): void {
    this.deleteTargetId = data.category.id;
    this.deleteTargetType = 'category';
    this.deleteMessage = `Are you sure you want to delete "${data.category.name}"?`;
    this.showDeleteModal = true;
  }

  onSaveCategory(name: string): void {
    this.categoryPopupError = '';
    this.categoryPopupLoading = true;
    const request = this.editingCategory
      ? this.categoryService.updateCategory(
          this.editingCategory.id,
          name.trim()
        )
      : this.categoryService.createCategory(name.trim());

    request.subscribe({
      next: () => {
        const wasEditing = !!this.editingCategory;
        this.loadCategories();
        this.closeCategoryModal();
        wasEditing
          ? this.toastService.success('Category updated successfully')
          : this.toastService.success('Category added successfully');
      },
      error: (err) => {
        this.categoryPopupError =
          err.error?.message || 'Could not save category.';
        this.categoryPopupLoading = false;
        this.toastService.error(this.categoryPopupError);
      },
    });
  }

  closeCategoryModal(): void {
    this.showCategoryModal = false;
    this.editingCategory = null;
    this.categoryPopupName = '';
    this.categoryPopupLoading = false;
  }

  // --- Search & Pagination with Debounce Logic ---
  onSearchChange(term: string): void {
    this.searchInputValue = term;
    this.isSearching = true;
    if (this.privateDebounce) clearTimeout(this.privateDebounce);
    this.privateDebounce = setTimeout(() => {
      this.searchTerm = term;
      this.currentPage = 0;
      this.loadSkills();
    }, 350);
  }

  // Clears just the search term, keeps the category filter intact
  clearSearchTerm(): void {
    if (this.privateDebounce) clearTimeout(this.privateDebounce);
    this.searchTerm = '';
    this.searchInputValue = '';
    this.isSearching = false;
    this.currentPage = 0;
    this.loadSkills();
  }

  clearAllFilters(): void {
    if (this.privateDebounce) clearTimeout(this.privateDebounce);
    this.searchTerm = '';
    this.searchInputValue = '';
    this.selectedFilterCategoryId = null;
    this.isSearching = false;
    this.currentPage = 0;
    this.loadSkills();
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.loadSkills();
  }

  // --- Deletion Logic ---
  onDeleteSkillClicked(id: number): void {
    const skill = this.skills.find((s) => s.id === id);
    this.deleteTargetId = id;
    this.deleteTargetType = 'skill';
    this.deleteMessage = skill
      ? `Are you sure you want to delete "${skill.name}"? This cannot be undone.`
      : 'Are you sure you want to delete this skill? This cannot be undone.';
    this.showDeleteModal = true;
  }

  onConfirmDelete(): void {
    if (!this.deleteTargetId) return;
    this.showDeleteModal = false;
    this.loading = true;
    this.errorMessage = '';

    if (this.deleteTargetType === 'skill') {
      if (this.editingSkillId === this.deleteTargetId) this.resetForm();
      this.skillsService.deleteSkill(this.deleteTargetId).subscribe({
        next: () => {
          // Page-backtrack (if the deleted skill was the last item on
          // this page) is now handled inside loadSkills() itself, so no
          // pre-check is needed here.
          this.loadSkills();
          this.loading = false;
          this.toastService.success('Skill deleted successfully');
        },
        error: (err) => {
          this.errorMessage =
            err.error?.message || 'Failed to delete skill. Please try again.';
          this.toastService.error(this.errorMessage);
          this.loading = false;
        },
      });
    } else {
      if (this.selectedFilterCategoryId === this.deleteTargetId)
        this.onFilterChange(null);
      this.categoryService.deleteCategory(this.deleteTargetId).subscribe({
        next: () => {
          this.loadCategories();
          // loadSkills() self-corrects if the category-cascade deletion
          // emptied the current page.
          this.loadSkills();
          this.loading = false;
          this.toastService.success('Category deleted successfully');
        },
        error: (err) => {
          this.errorMessage =
            err.error?.message ||
            'Failed to delete category. Please try again.';
          this.toastService.error(this.errorMessage);
          this.loading = false;
        },
      });
    }
  }

  onCancelDelete(): void {
    this.showDeleteModal = false;
    this.deleteTargetId = undefined;
  }
}
