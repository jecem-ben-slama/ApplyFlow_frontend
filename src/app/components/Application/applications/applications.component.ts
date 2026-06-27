import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';

import { ApplicationsService } from '../../../services/applications.service';
import { SkillsService } from '../../../services/skills.service';
import { CvVariantsService } from '../../../services/cv-variants.service';
import { TemplateService } from '../../../services/template.service';
import { EmailService } from '../../../services/email.service';

import {
  ApplicationResponseDto,
  ApplicationCreateDto,
  Page,
  Skill,
  CvVariantDto,
  TemplateDto,
  getPageMeta,
} from '../../../models';

import { PaginationComponent } from '../../common/pagination/pagination.component';
import { ApplicationPopupComponent } from '../application-popup/application-popup.component';
import { DeletePopupComponent } from '../../common/delete-popup/delete-popup.component';
import { ApplicationRowComponent } from '../aplication-row/application-row.component';
import { EmailPanelComponent } from "../email-panel/email-panel.component";

@Component({
  selector: 'app-applications',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    PaginationComponent,
    ApplicationPopupComponent,
    DeletePopupComponent,
    ApplicationRowComponent,
    EmailPanelComponent
],
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

  filterStatus = '';
  filterKeyword = '';

  availableSkills: Skill[] = [];
  availableCvVariants: CvVariantDto[] = [];
  availableTemplates: TemplateDto[] = [];

  isLoading = false;
  isSendingEmail = false;
  isModalOpen = false;
  errorMessage = '';
  successMessage = '';

  showDeleteModal = false;
  deleteTargetId?: number;
  deleteMessage = 'Permanently purge this compiled tracking profile record?';

  expandedAppId: number | null = null;

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
        this.currentPage, this.pageSize, this.sortBy, this.direction,
        this.filterStatus || undefined, this.filterKeyword || undefined
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
        this.errorMessage = err.error?.message || 'Error loading workspace data.';
        this.isLoading = false;
      },
    });
  }

  loadApplicationsPage(): void {
    this.isLoading = true;
    this.appService.getAllApplications(
      this.currentPage, this.pageSize, this.sortBy, this.direction,
      this.filterStatus || undefined, this.filterKeyword || undefined
    ).subscribe({
      next: (page) => {
        this.appPage = page;
        const meta = getPageMeta(page);
        this.currentPage = meta.number;
        this.appTotalPages = meta.totalPages;
        this.isLoading = false;
      },
      error: (err) => {
        this.errorMessage = err.error?.message || 'Could not fetch applications.';
        this.isLoading = false;
      },
    });
  }

  // ── Search & pagination ────────────────────────────────────────────────────

  onSearch(): void {
    this.currentPage = 0;
    this.expandedAppId = null;
    this.loadApplicationsPage();
  }

  onClearFilters(): void {
    this.filterStatus = '';
    this.filterKeyword = '';
    this.currentPage = 0;
    this.expandedAppId = null;
    this.loadApplicationsPage();
  }

  onPageChange(newPage: number): void {
    this.currentPage = newPage;
    this.expandedAppId = null;
    this.loadApplicationsPage();
  }

  // ── Row events ─────────────────────────────────────────────────────────────

  onTogglePanel(appId: number): void {
    this.expandedAppId = this.expandedAppId === appId ? null : appId;
  }

  onUpdateStatus(id: number, status: string): void {
    this.appService.patchApplicationStatusOrNotes(id, status, undefined).subscribe({
      next: () => {
        this.showFeedback(`Status updated to ${status}.`);
        this.loadApplicationsPage();
      },
      error: (err) => (this.errorMessage = err.error?.message || 'Could not update status.'),
    });
  }

  onSaveNotes(appId: number, notes: string): void {
    this.appService.patchApplicationStatusOrNotes(appId, undefined, notes).subscribe({
      next: () => {
        const app = this.appPage?.content.find((a) => a.id === appId);
        if (app) app.notes = notes;
      },
      error: (err) => (this.errorMessage = err.error?.message || 'Could not save notes.'),
    });
  }

  onSendEmail(app: ApplicationResponseDto): void {
    if (!app.recipientEmail) {
      this.errorMessage = 'Cannot send: recipient email is missing.';
      return;
    }
    this.isSendingEmail = true;
    this.errorMessage = '';

    this.emailService.sendEmail({
      recipientEmail: app.recipientEmail,
      subject: app.generatedSubject,
      body: app.generatedBody,
      cvVariantId: app.cvVariantId ? Number(app.cvVariantId) : undefined,
    }).subscribe({
      next: (msg) => {
        this.showFeedback(msg || 'Email sent!');
        this.onUpdateStatus(app.id, 'SENT');
        this.isSendingEmail = false;
      },
      error: (err) => {
        this.errorMessage = err.error?.message || 'Email delivery failed.';
        this.isSendingEmail = false;
      },
    });
  }

  onCopyBody(text: string): void {
    navigator.clipboard.writeText(text).then(() => this.showFeedback('Copied to clipboard.'));
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  onDelete(id: number): void {
    this.deleteTargetId = id;
    this.showDeleteModal = true;
  }

  onConfirmDelete(): void {
    const id = this.deleteTargetId;
    if (!id) return;
    this.showDeleteModal = false;
    this.appService.deleteApplication(id).subscribe({
      next: () => {
        this.showFeedback('Application deleted.');
        if (this.expandedAppId === id) this.expandedAppId = null;
        this.loadApplicationsPage();
      },
      error: (err) => (this.errorMessage = err.error?.message || 'Could not delete.'),
    });
  }

  onCancelDelete(): void {
    this.showDeleteModal = false;
    this.deleteTargetId = undefined;
  }

  // ── Modal ──────────────────────────────────────────────────────────────────

  openCreateModal(): void {
    this.isModalOpen = true;
  }

  closeModal(): void {
    this.isModalOpen = false;
    this.errorMessage = '';
  }

  onCreateSubmit(payload: ApplicationCreateDto): void {
    this.isLoading = true;
    this.appService.createApplication(payload).subscribe({
      next: (created) => {
        this.showFeedback('Application created successfully!');
        this.isModalOpen = false;
        this.expandedAppId = created.id;
        this.loadApplicationsPage();
        this.isLoading = false;
      },
      error: (err) => {
        this.errorMessage = err.error?.message || 'Failed to create application.';
        this.isLoading = false;
      },
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private showFeedback(msg: string): void {
    this.successMessage = msg;
    setTimeout(() => (this.successMessage = ''), 4000);
  }
}
