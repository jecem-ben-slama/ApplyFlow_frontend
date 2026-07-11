import { Component, OnInit } from '@angular/core';
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

// Sub-components

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
  ],
  templateUrl: './skills.component.html',
})
export class SkillsComponent implements OnInit {
  skills: Skill[] = [];
  categories: Category[] = [];

  loading = false;
  initialLoading = true; // true only until the first fetch completes; controls the full-page skeleton
  errorMessage = '';

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
    private categoryService: CategoryService
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
        console.error('Failed to load categories:', err);
        this.errorMessage =
          'Could not load categories. Please refresh the page.';
      },
    });
  }

  loadSkills(): void {
    this.loading = true;
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
          this.skills = page.content;
          this.totalPages = meta.totalPages;
          this.totalElements = meta.totalElements;
          this.loading = false;
          this.isSearching = false;
          this.initialLoading = false;
        },
        error: (err) => {
          console.error('Error fetching skills:', err);
          this.errorMessage = 'Could not load skills. Please try again.';
          this.loading = false;
          this.isSearching = false;
          this.initialLoading = false;
        },
      });
  }

  dismissError(): void {
    this.errorMessage = '';
  }

  // --- Handlers for Skill Form ---
  onSaveSkill(formData: any): void {
    this.loading = true;
    this.errorMessage = '';
    if (this.editingSkillId !== null) {
      this.skillsService.updateSkill(this.editingSkillId, formData).subscribe({
        next: () => {
          this.resetForm();
          this.loadSkills();
        },
        error: (err) => {
          console.error('Failed to update skill:', err);
          this.errorMessage =
            err.error?.message || 'Failed to update skill. Please try again.';
          this.loading = false;
        },
      });
    } else {
      this.skillsService.createSkill(formData).subscribe({
        next: () => {
          this.resetForm();
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
            });
        },
        error: (err) => {
          console.error('Failed to create skill:', err);
          this.errorMessage =
            err.error?.message || 'Failed to create skill. Please try again.';
          this.loading = false;
        },
      });
    }
  }

  onEditSkillClicked(skill: Skill): void {
    this.editingSkillId = skill.id;
    this.isFormExpanded = true;
    this.newSkillData = {
      name: skill.name || '',
      sentenceEn: skill.sentenceEn || '',
      sentenceFr: skill.sentenceFr || '',
      categoryId: skill.categoryId ?? null,
    };

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  resetForm(): void {
    this.editingSkillId = null;

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
    this.deleteMessage = `Are you sure you want to delete "${data.category.name}"? Skills associated will be untagged.`;
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
        this.loadCategories();
        this.closeCategoryModal();
      },
      error: (err) => {
        console.error('Failed to save category:', err);
        this.categoryPopupError =
          err.error?.message || 'Could not save category.';
        this.categoryPopupLoading = false;
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
          if (this.skills.length - 1 === 0 && this.currentPage > 0)
            this.currentPage--;
          this.loadSkills();
          this.loading = false;
        },
        error: (err) => {
          console.error('Failed to delete skill:', err);
          this.errorMessage =
            err.error?.message || 'Failed to delete skill. Please try again.';
          this.loading = false;
        },
      });
    } else {
      if (this.selectedFilterCategoryId === this.deleteTargetId)
        this.onFilterChange(null);
      this.categoryService.deleteCategory(this.deleteTargetId).subscribe({
        next: () => {
          this.loadCategories();
          this.loadSkills();
          this.loading = false;
        },
        error: (err) => {
          console.error('Failed to delete category:', err);
          this.errorMessage =
            err.error?.message ||
            'Failed to delete category. Please try again.';
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
