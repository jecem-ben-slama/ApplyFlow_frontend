import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';

// Services
import { ApplicationsService } from '../../../services/applications.service';
import { SkillsService } from '../../../services/skills.service';
import { CvVariantsService } from '../../../services/cv-variants.service';
import { TemplateService } from '../../../services/template.service';
import { EmailService } from '../../../services/email.service';

// Models
import {
  ApplicationResponseDto,
  ApplicationCreateDto,
  Page,
  Skill,
  CvVariantDto,
  TemplateDto,
  getPageMeta,
} from '../../../models';
import { PaginationComponent } from '../../pagination/pagination.component';
import { ApplicationPopupComponent } from '../application-popup/application-popup.component';

@Component({
  selector: 'app-applications',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    PaginationComponent,
    ApplicationPopupComponent,
  ], // <-- Add to imports
  templateUrl: './applications.component.html',
  styleUrls: ['./applications.component.css'],
})
export class ApplicationsComponent implements OnInit {
  appPage?: Page<ApplicationResponseDto>;
  currentPage = 0;
  pageSize = 10;
  sortBy = 'dateApplied';
  direction: 'asc' | 'desc' = 'desc';
  appTotalPages = 0;

  availableSkills: Skill[] = [];
  availableCvVariants: CvVariantDto[] = [];
  availableTemplates: TemplateDto[] = [];

  isLoading = false;
  isSendingEmail = false;
  isModalOpen = false;
  selectedApplication?: ApplicationResponseDto;
  errorMessage = '';
  successMessage = '';

  expandedAppId: number | null = null;
  editingNotesAppId: number | null = null;
  editingNotesValue = '';
  notesSavedForId: number | null = null;

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
        const meta = getPageMeta(result.applications);
        this.currentPage = meta.number;
        this.appTotalPages = meta.totalPages;
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
          const meta = getPageMeta(page);
          this.currentPage = meta.number;
          this.appTotalPages = meta.totalPages;
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
    this.expandedAppId = null;
    this.editingNotesAppId = null;
    this.loadApplicationsPage();
  }

  toggleEmailPanel(appId: number): void {
    if (this.expandedAppId === appId) {
      this.expandedAppId = null;
      this.editingNotesAppId = null;
    } else {
      this.expandedAppId = appId;
      this.editingNotesAppId = null;
    }
  }

  startEditNotes(app: ApplicationResponseDto): void {
    this.editingNotesAppId = app.id;
    this.editingNotesValue = app.notes ?? '';
  }

  cancelEditNotes(): void {
    this.editingNotesAppId = null;
    this.editingNotesValue = '';
  }

  saveNotes(app: ApplicationResponseDto): void {
    this.appService
      .patchApplicationStatusOrNotes(app.id, undefined, this.editingNotesValue)
      .subscribe({
        next: () => {
          app.notes = this.editingNotesValue;
          this.editingNotesAppId = null;
          this.editingNotesValue = '';
          this.notesSavedForId = app.id;
          setTimeout(() => (this.notesSavedForId = null), 2000);
        },
        error: (err) => {
          this.errorMessage = err.error?.message || 'Could not save notes.';
        },
      });
  }

  onSendEmailFromPanel(app: ApplicationResponseDto): void {
    if (!app.recipientEmail) {
      this.errorMessage =
        'Cannot dispatch email: Recipient email address is missing.';
      return;
    }

    this.isSendingEmail = true;
    this.errorMessage = '';

    this.emailService
      .sendEmail({
        recipientEmail: app.recipientEmail,
        subject: app.generatedSubject,
        body: app.generatedBody,
        cvVariantId: app.cvVariantId ? Number(app.cvVariantId) : undefined,
      })
      .subscribe({
        next: (msg) => {
          this.showFeedback(msg || 'Email dispatched successfully!');
          this.onUpdateStatus(app.id, 'SENT');
          this.isSendingEmail = false;
        },
        error: (err) => {
          this.errorMessage =
            err.error?.message || 'Outbound SMTP delivery failure.';
          this.isSendingEmail = false;
        },
      });
  }

  copyToClipboard(text: string): void {
    navigator.clipboard.writeText(text).then(() => {
      this.showFeedback('Email body copied to clipboard.');
    });
  }

  openCreateModal(): void {
    this.isModalOpen = true;
  }

  closeModal(): void {
    this.isModalOpen = false;
    this.selectedApplication = undefined;
    this.errorMessage = '';
  }

  viewCompiledEmail(app: ApplicationResponseDto): void {
    this.expandedAppId = app.id;
  }

  // Receives the mapped payload directly from the child modal
  onCreateSubmit(payload: ApplicationCreateDto): void {
    this.isLoading = true;

    this.appService.createApplication(payload).subscribe({
      next: (createdRecord) => {
        this.showFeedback(
          'Application tracking sequence created and engine compiled successfully!'
        );
        this.isModalOpen = false;
        this.loadApplicationsPage();
        this.viewCompiledEmail(createdRecord);
        this.isLoading = false;
      },
      error: (err) => {
        this.errorMessage =
          err.error?.message ||
          'Failed to trigger application compilation pipeline.';
        this.isLoading = false;
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
        if (this.expandedAppId === id) this.expandedAppId = null;
        this.loadApplicationsPage();
      },
      error: (err) =>
        (this.errorMessage = err.error?.message || 'Could not drop entry.'),
    });
  }

  onSendCompiledEmail(): void {
    if (!this.selectedApplication) return;
    this.onSendEmailFromPanel(this.selectedApplication);
  }

  private showFeedback(msg: string): void {
    this.successMessage = msg;
    setTimeout(() => (this.successMessage = ''), 4000);
  }
}
