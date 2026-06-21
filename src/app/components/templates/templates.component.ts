import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { trigger, style, transition, animate } from '@angular/animations';
import { TemplateService } from '../../services/template.service';
import { TemplateDto, Page } from '../../models';

@Component({
  selector: 'app-templates',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
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
  templates: TemplateDto[] = [];
  loading = false;

  isFormVisible = true;
  editingTemplateId: number | null = null;

  subjectPlaceholder = 'e.g., Application Update: {{ positionName }}';

  // Pagination & Filtering state
  currentPage = 0;
  pageSize = 10;
  totalPages = 0;
  totalElements = 0;
  selectedLanguage: string | undefined = undefined;

  newTemplate = {
    name: '',
    language: 'EN',
    tier: 1,
    subjectTemplate: '',
    bodyTemplate: '',
  };

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
        this.selectedLanguage
      )
      .subscribe({
        next: (page: Page<TemplateDto>) => {
          this.templates = page.content;
          this.totalPages = page.totalPages;
          this.totalElements = page.totalElements;
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
      tier: template.tier,
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
      tier: 1,
      subjectTemplate: '',
      bodyTemplate: '',
    };
  }

  onSubmitTemplate(): void {
    if (
      !this.newTemplate.name ||
      !this.newTemplate.subjectTemplate ||
      !this.newTemplate.bodyTemplate
    ) {
      alert(
        'Please populate the template name, subject line, and body content configurations.'
      );
      return;
    }

    this.loading = true;

    if (this.editingTemplateId !== null) {
      this.templateService
        .updateTemplate(this.editingTemplateId, this.newTemplate)
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
            this.loading = false;
          },
        });
    } else {
      this.templateService.createTemplate(this.newTemplate).subscribe({
        next: () => {
          this.onCancelEdit();
          this.loadTemplates();
        },
        error: (err) => {
          console.error(
            'Failed to append custom profile template record:',
            err
          );
          this.loading = false;
        },
      });
    }
  }

  onDeleteTemplate(id: number | undefined): void {
    if (!id) return;
    if (!confirm('Are you sure you want to drop this layout parsing template?'))
      return;
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

  onPageChange(newPage: number): void {
    this.currentPage = newPage;
    this.loadTemplates();
  }
}
