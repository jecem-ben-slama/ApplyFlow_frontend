import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { trigger, style, transition, animate } from '@angular/animations';
import { getPageMeta, Page, TemplateDto } from 'src/app/models';
import { TemplateService } from 'src/app/services/template.service';
import { DeletePopupComponent } from '../../common/delete-popup/delete-popup.component';
import { TemplateListComponent } from '../template-list/template-list.component';
import {
  TemplateFormComponent,
  TemplateData,
} from '../template-form/template-form.component';
import { SkeletonComponent } from '../../common/skeleton/skeleton.components';

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
    SkeletonComponent,
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
export class TemplatesComponent implements OnInit {
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
  private searchDebounce: ReturnType<typeof setTimeout> | null = null;

  newTemplate: TemplateData = {
    name: '',
    language: 'EN',
    subjectTemplate: '',
    bodyTemplate: '',
  };

  showDeleteModal = false;
  deleteTargetId?: number;
  deleteMessage = 'Are you sure you want to drop this layout parsing template?';

  constructor(private templateService: TemplateService) {}

  ngOnInit(): void {
    this.adjustFormVisibilityForViewport();
    this.loadTemplates();
  }

  adjustFormVisibilityForViewport(): void {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      this.isFormVisible = false;
    }
  }

  loadTemplates(): void {
    this.loading = true;
    this.templateService
      .getAllTemplates(
        this.currentPage,
        this.pageSize,
        'id',
        'asc',
        this.selectedLanguage,
        this.searchTerm || undefined
      )
      .subscribe({
        next: (page: Page<TemplateDto>) => {
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
          console.error('Error fetching workspace templates profile:', err);
          this.loading = false;
        },
      });
  }

  onToggleForm(): void {
    this.isFormVisible = !this.isFormVisible;
  }

  updateSearchTerm(term: string): void {
    this.searchTerm = term;
    this.onSearchChange();
  }

  onSearchChange(): void {
    if (this.searchDebounce) clearTimeout(this.searchDebounce);
    this.searchDebounce = setTimeout(() => {
      this.currentPage = 0;
      this.loadTemplates();
    }, 350);
  }

  onLanguageFilterChange(lang: string): void {
    this.selectedLanguage = lang === 'ALL' ? undefined : lang;
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
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  onCancelEdit(): void {
    this.editingTemplateId = null;
    this.newTemplate = {
      name: '',
      language: 'EN',
      subjectTemplate: '',
      bodyTemplate: '',
    };
  }

  onSubmitTemplate(data: TemplateData): void {
    this.loading = true;
    this.errorMessage = '';

    // Form-level required-field validation is already enforced in
    // TemplateFormComponent (NgForm), so we don't need to re-check
    // trimmed emptiness here — but we keep this as a defensive backstop
    // in case the component is ever driven programmatically.
    if (
      !data.name?.trim() ||
      !data.subjectTemplate?.trim() ||
      !data.bodyTemplate?.trim()
    ) {
      this.errorMessage = 'Please fill in all required fields.';
      this.loading = false;
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
          },
          error: (err) => {
            console.error(
              'Failed to patch targeted template entry context:',
              err
            );
            this.errorMessage = 'Failed to update template. Please try again.';
            this.loading = false;
          },
        });
    } else {
      this.templateService.createTemplate(data).subscribe({
        next: () => {
          this.onCancelEdit();
          this.loadTemplates();
        },
        error: (err) => {
          console.error(
            'Failed to append custom profile template record template entry:',
            err
          );
          this.errorMessage = 'Failed to create template. Please try again.';
          this.loading = false;
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
      next: () => this.loadTemplates(),
      error: (err) =>
        console.error(
          'Failed to clear layout template profile key configuration:',
          err
        ),
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
