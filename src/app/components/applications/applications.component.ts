import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';

// Services
import { ApplicationsService } from '../../services/applications.service';
import { SkillsService } from '../../services/skills.service';
import { CvVariantsService } from '../../services/cv-variants.service';
import { TemplateService } from '../../services/template.service';
import { EmailService } from '../../services/email.service';

// Models
import {
  ApplicationResponseDto,
  ApplicationCreateDto,
  Page,
  Skill,
  CvVariantDto,
  TemplateDto,
} from '../../models';

@Component({
  selector: 'app-applications',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './applications.component.html',
  styleUrls: ['./applications.component.css'],
})
export class ApplicationsComponent implements OnInit {
  appPage?: Page<ApplicationResponseDto>;
  currentPage = 0;
  pageSize = 10;
  sortBy = 'dateApplied';
  direction: 'asc' | 'desc' = 'desc';

  availableSkills: Skill[] = [];
  availableCvVariants: CvVariantDto[] = [];
  availableTemplates: TemplateDto[] = [];

  selectedTemplatePreview?: TemplateDto;

  isLoading = false;
  isSendingEmail = false;
  isModalOpen = false;
  selectedApplication?: ApplicationResponseDto;
  errorMessage = '';
  successMessage = '';

  formModel: ApplicationCreateDto = {
    companyName: '',
    jobTitle: '',
    recipientEmail: '',
    language: 'en',
    templateId: undefined,
    cvVariantId: undefined,
    userId: 0,
    skillIds: [],
  };

  constructor(
    private appService: ApplicationsService,
    private skillsService: SkillsService,
    private cvService: CvVariantsService,
    private templateService: TemplateService,
    private emailService: EmailService
  ) {}

  ngOnInit(): void {
    this.loadInitialWorkspaceData();
  }

  loadInitialWorkspaceData(): void {
    this.isLoading = true;
    this.errorMessage = '';

    forkJoin({
      applications: this.appService.getAllApplications(
        this.currentPage,
        this.pageSize,
        this.sortBy,
        this.direction
      ),
      skills: this.skillsService.getAllSkills(0, 100),
      cvVariants: this.cvService.getAllCvVariants(0, 100),
      templates: this.templateService.getAllTemplates(0, 100),
    }).subscribe({
      next: (result) => {
        this.appPage = result.applications;
        this.availableSkills = result.skills.content;
        this.availableCvVariants = result.cvVariants.content;
        this.availableTemplates = result.templates.content;
        this.isLoading = false;
      },
      error: (err) => {
        this.errorMessage =
          err.error?.message ||
          'Error populating structural workspace lookups.';
        this.isLoading = false;
      },
    });
  }

  loadApplicationsPage(): void {
    this.isLoading = true;
    this.appService
      .getAllApplications(
        this.currentPage,
        this.pageSize,
        this.sortBy,
        this.direction
      )
      .subscribe({
        next: (page) => {
          this.appPage = page;
          this.isLoading = false;
        },
        error: (err) => {
          this.errorMessage = err.error?.message || 'Could not fetch history.';
          this.isLoading = false;
        },
      });
  }

  onPageChange(newPage: number): void {
    this.currentPage = newPage;
    this.loadApplicationsPage();
  }

  openCreateModal(): void {
    this.formModel = {
      companyName: '',
      jobTitle: '',
      recipientEmail: '',
      language: 'en',
      templateId: undefined,
      cvVariantId: undefined,
      userId: 0,
      skillIds: [],
    };
    this.selectedTemplatePreview = undefined;
    this.isModalOpen = true;
  }

  closeModal(): void {
    this.isModalOpen = false;
    this.selectedApplication = undefined;
    this.selectedTemplatePreview = undefined;
    this.errorMessage = '';
  }

  viewCompiledEmail(app: ApplicationResponseDto): void {
    this.selectedApplication = app;
  }

  onTemplateChange(): void {
    if (!this.formModel.templateId) {
      this.selectedTemplatePreview = undefined;
      return;
    }
    this.selectedTemplatePreview = this.availableTemplates.find(
      (t) => t.id === Number(this.formModel.templateId)
    );
  }

  hasPlaceholder(tagFragment: string): boolean {
    if (!this.selectedTemplatePreview?.bodyTemplate) return false;
    return this.selectedTemplatePreview.bodyTemplate
      .toLowerCase()
      .includes(tagFragment.toLowerCase());
  }

  getLiveTemplateBodyPreview(): string {
    if (!this.selectedTemplatePreview?.bodyTemplate) return '';

    let rawBody = this.selectedTemplatePreview.bodyTemplate;
    const companyReplacer =
      this.formModel.companyName || '[Company Destination]';
    const positionReplacer = this.formModel.jobTitle || '[Target Job Title]';

    return rawBody
      .replace(/\{\{companyname\}\}/gi, companyReplacer)
      .replace(/\{\{company\}\}/gi, companyReplacer)
      .replace(/\{\{position\}\}/gi, positionReplacer)
      .replace(/\{\{role\}\}/gi, positionReplacer);
  }

  toggleSkillSelection(skillId: number): void {
    const index = this.formModel.skillIds.indexOf(skillId);
    if (index > -1) {
      this.formModel.skillIds.splice(index, 1);
    } else {
      this.formModel.skillIds.push(skillId);
    }
  }

  onSubmit(): void {
    if (!this.formModel.templateId) {
      this.errorMessage = 'Please select a base template configuration layout.';
      return;
    }

    this.isLoading = true;

    const activeTemplate = this.availableTemplates.find(
      (t) => t.id === Number(this.formModel.templateId)
    );

    if (activeTemplate) {
      activeTemplate.bodyTemplate = activeTemplate.bodyTemplate.replace(
        /\{\{companyname\}\}/gi,
        '{{company}}'
      );
      activeTemplate.subjectTemplate = activeTemplate.subjectTemplate.replace(
        /\{\{companyname\}\}/gi,
        '{{company}}'
      );
    }

    const payload: ApplicationCreateDto = {
      ...this.formModel,
      templateId: Number(this.formModel.templateId),
      cvVariantId: this.formModel.cvVariantId
        ? Number(this.formModel.cvVariantId)
        : undefined,
    };

    this.appService.createApplication(payload).subscribe({
      next: (createdRecord) => {
        this.showFeedback(
          'Application tracking sequence created and engine compiled successfully!'
        );
        this.isModalOpen = false;
        this.loadApplicationsPage();
        this.viewCompiledEmail(createdRecord);
      },
      error: (err) => {
        this.errorMessage =
          err.error?.message ||
          'Failed to trigger application compilation pipeline.';
        this.isLoading = false;
      },
    });
  }

  onSendCompiledEmail(): void {
    if (!this.selectedApplication) return;

    // Direct structural safety guard: stop execution if there is no recipient address
    if (!this.selectedApplication.recipientEmail) {
      this.errorMessage =
        'Cannot dispatch email: Recipient email address is missing.';
      return;
    }

    this.isSendingEmail = true;
    this.errorMessage = '';

    this.emailService
      .sendEmail({
        userId: this.selectedApplication.userId,
        recipientEmail: this.selectedApplication.recipientEmail, // TS now knows this is guaranteed to be a string!
        subject: this.selectedApplication.generatedSubject,
        body: this.selectedApplication.generatedBody,
      })
      .subscribe({
        next: (msg) => {
          this.showFeedback(
            msg || 'Email dynamic delivery executed successfully!'
          );

          if (this.selectedApplication) {
            this.onUpdateStatus(this.selectedApplication.id, 'SENT');
          }
          this.closeModal();
          this.isSendingEmail = false;
        },
        error: (err) => {
          this.errorMessage =
            err.error?.message ||
            'Outbound OAuth2 SMTP delivery authentication failure.';
          this.isSendingEmail = false;
        },
      });
  }

  onUpdateStatus(id: number, newStatus: string): void {
    this.appService
      .patchApplicationStatusOrNotes(id, newStatus, undefined)
      .subscribe({
        next: () => {
          this.showFeedback(`Application status marked as ${newStatus}.`);
          this.loadApplicationsPage();
        },
        error: (err) =>
          (this.errorMessage =
            err.error?.message || 'Could not patch status change.'),
      });
  }

  onDelete(id: number): void {
    if (!confirm('Permanently purge this compiled tracking profile record?'))
      return;
    this.appService.deleteApplication(id).subscribe({
      next: () => {
        this.showFeedback('Application profile discarded.');
        this.loadApplicationsPage();
      },
      error: (err) =>
        (this.errorMessage = err.error?.message || 'Could not drop entry.'),
    });
  }

  private showFeedback(msg: string): void {
    this.successMessage = msg;
    setTimeout(() => (this.successMessage = ''), 4000);
  }
}
