import { Component, OnInit } from '@angular/core';
import { SkillsService } from '../../services/skills.service';
import { CategoryService } from '../../services/category.service';
import { Category, Skill, getPageMeta } from '../../models';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DeletePopupComponent } from '../common/delete-popup/delete-popup.component';
import { CategoryPopupComponent } from './category-popup/category-popup.component';
import { trigger, style, transition, animate } from '@angular/animations';
import { PaginationComponent } from '../common/pagination/pagination.component';

@Component({
  selector: 'app-skills',
  templateUrl: './skills.component.html',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    PaginationComponent,
    DeletePopupComponent,
    CategoryPopupComponent,
  ],
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
export class SkillsComponent implements OnInit {
  skills: Skill[] = [];
  categories: Category[] = [];

  loading = false;
  errorMessage = '';

  isFormVisible = false;
  editingSkillId: number | null = null;

  currentPage = 0;
  pageSize = 8;
  totalPages = 0;
  totalElements = 0;

  selectedFilterCategoryId: number | null = null;
  searchTerm = '';
  private searchDebounce: ReturnType<typeof setTimeout> | null = null;

  newSkill: {
    name: string;
    sentenceEn: string;
    sentenceFr: string;
    categoryId: number | null;
  } = {
    name: '',
    sentenceEn: '',
    sentenceFr: '',
    categoryId: null,
  };

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

  loadCategories(): void {
    this.categoryService.getAllCategories().subscribe({
      next: (cats) => (this.categories = cats),
      error: (err) => console.error('Failed to load categories:', err),
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
        },
        error: (err) => {
          console.error('Error fetching skills:', err);
          this.loading = false;
        },
      });
  }

  onSearchChange(): void {
    if (this.searchDebounce) clearTimeout(this.searchDebounce);
    this.searchDebounce = setTimeout(() => {
      this.currentPage = 0;
      this.loadSkills();
    }, 350);
  }

  onFilterByCategory(categoryId: number | null): void {
    this.selectedFilterCategoryId = categoryId;
    this.currentPage = 0;
    this.loadSkills();
  }

  onToggleForm(): void {
    this.isFormVisible = !this.isFormVisible;
  }

  onEditClick(skill: Skill): void {
    this.editingSkillId = skill.id;
    this.isFormVisible = true;
    this.newSkill = {
      name: skill.name || '',
      sentenceEn: skill.sentenceEn || '',
      sentenceFr: skill.sentenceFr || '',
      categoryId: skill.categoryId ?? null,
    };
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  onCancelEdit(): void {
    this.editingSkillId = null;
    this.newSkill = {
      name: '',
      sentenceEn: '',
      sentenceFr: '',
      categoryId: null,
    };
  }

  onCreateSkill(): void {
    this.errorMessage = '';
    if (!this.newSkill.name?.trim()) {
      this.errorMessage = 'Skill display name is required.';
      return;
    }
    if (!this.newSkill.sentenceEn?.trim()) {
      this.errorMessage = 'English sentence example is required.';
      return;
    }

    this.loading = true;

    if (this.editingSkillId !== null) {
      this.skillsService
        .updateSkill(this.editingSkillId, this.newSkill)
        .subscribe({
          next: () => {
            this.onCancelEdit();
            this.loadSkills();
          },
          error: (err) => {
            console.error('Failed to update skill:', err);
            this.loading = false;
          },
        });
    } else {
      this.skillsService.createSkill(this.newSkill).subscribe({
        next: () => {
          this.newSkill = {
            name: '',
            sentenceEn: '',
            sentenceFr: '',
            categoryId: null,
          };
          this.skillsService
            .getAllSkills(
              0,
              this.pageSize,
              'id',
              'asc',
              this.selectedFilterCategoryId,
              this.searchTerm || undefined
            )
            .subscribe((peek) => {
              const meta = getPageMeta(peek);
              this.currentPage = Math.max(0, meta.totalPages - 1);
              this.loadSkills();
            });
        },
        error: (err) => {
          console.error('Failed to create skill:', err);
          this.loading = false;
        },
      });
    }
  }

  onDeleteSkill(id: number): void {
    this.deleteTargetId = id;
    this.deleteTargetType = 'skill';
    this.deleteMessage =
      'Are you sure you want to drop this skill parsing block?';
    this.showDeleteModal = true;
  }

  onDeleteCategory(category: Category, event: MouseEvent): void {
    event.stopPropagation();
    this.deleteTargetId = category.id;
    this.deleteTargetType = 'category';
    this.deleteMessage = `Are you sure you want to delete the category "${category.name}"? This will untag skills associated with it.`;
    this.showDeleteModal = true;
  }

  openCategoryModal(): void {
    this.editingCategory = null;
    this.categoryPopupName = '';
    this.categoryPopupError = '';
    this.categoryPopupLoading = false;
    this.showCategoryModal = true;
  }

  onEditCategory(category: Category): void {
    this.editingCategory = category;
    this.categoryPopupName = category.name;
    this.categoryPopupError = '';
    this.categoryPopupLoading = false;
    this.showCategoryModal = true;
  }

  closeCategoryModal(): void {
    this.showCategoryModal = false;
    this.editingCategory = null;
    this.categoryPopupName = '';
    this.categoryPopupError = '';
    this.categoryPopupLoading = false;
  }

  onSaveCategory(name: string): void {
    this.categoryPopupError = '';
    if (!name.trim()) {
      this.categoryPopupError = 'Category name is required.';
      return;
    }
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
          err.error?.message || 'Could not save category. Please try again.';
        this.categoryPopupLoading = false;
      },
    });
  }

  onConfirmDelete(): void {
    const id = this.deleteTargetId;
    if (!id) return;

    this.showDeleteModal = false;
    this.loading = true;

    if (this.deleteTargetType === 'skill') {
      if (this.editingSkillId === id) this.onCancelEdit();
      this.skillsService.deleteSkill(id).subscribe({
        next: () => {
          const remainingOnPage = this.skills.length - 1;
          if (remainingOnPage === 0 && this.currentPage > 0) this.currentPage--;
          this.loadSkills();
          this.loading = false;
        },
        error: (err) => {
          console.error('Failed to delete skill:', err);
          this.loading = false;
        },
      });
    } else if (this.deleteTargetType === 'category') {
      if (this.selectedFilterCategoryId === id) {
        this.onFilterByCategory(null);
      }
      this.categoryService.deleteCategory(id).subscribe({
        next: () => {
          this.loadCategories();
          this.loadSkills(); // Refresh skills to reflect removed/untagged categories
          this.loading = false;
        },
        error: (err) => {
          console.error('Failed to delete category:', err);
          this.loading = false;
        },
      });
    }
  }

  onCancelDelete(): void {
    this.showDeleteModal = false;
    this.deleteTargetId = undefined;
  }

  onPageChange(newPage: number): void {
    if (newPage < 0 || newPage >= this.totalPages) return;
    this.currentPage = newPage;
    this.loadSkills();
  }

  getCategoryName(categoryId: number | null | undefined): string {
    if (!categoryId) return '—';
    return this.categories.find((c) => c.id === categoryId)?.name ?? '—';
  }
}
