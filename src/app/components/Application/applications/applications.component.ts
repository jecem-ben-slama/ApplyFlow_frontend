import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

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
  Category,
  CvVariantDto,
  TemplateDto,
  getPageMeta,
} from '../../../models';

import { PaginationComponent } from '../../common/pagination/pagination.component';
import { ApplicationPopupComponent } from '../application-popup/application-popup.component';
import { DeletePopupComponent } from '../../common/delete-popup/delete-popup.component';
import { ApplicationRowComponent } from '../aplication-row/application-row.component';
import { EmailPanelComponent } from '../email-panel/email-panel.component';
import { MatIconModule } from '@angular/material/icon';
import { CategoryService } from 'src/app/services/category.service';
import { SkeletonComponent } from '../../common/skeleton/skeleton.components';

type SortableColumn = 'companyName' | 'jobTitle' | 'dateApplied' | 'status';

interface Toast {
  id: number;
  type: 'success' | 'error';
  message: string;
}

@Component({
  selector: 'app-applications',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    PaginationComponent,
    ApplicationPopupComponent,
    DeletePopupComponent,
    ApplicationRowComponent,
    EmailPanelComponent,
    SkeletonComponent,
  ],
  templateUrl: './applications.component.html',
  styleUrls: ['./applications.component.css'],
})
export class ApplicationsComponent implements OnInit, OnDestroy {
  appPage?: Page<ApplicationResponseDto>;
  currentPage = 0;
  pageSize = 10;
  sortBy: SortableColumn = 'dateApplied';
  direction: 'asc' | 'desc' = 'desc';
  appTotalPages = 0;

  filterStatus = '';
  filterKeyword = '';

  availableSkills: Skill[] = [];
  availableCategories: Category[] = [];
  availableCvVariants: CvVariantDto[] = [];
  availableTemplates: TemplateDto[] = [];

  /** True only for full-page loads (initial load, page change, filter change). */
  isLoading = false;
  /** True while any table refresh is happening — used for lighter, non-skeleton loading UI. */
  isRefreshing = false;
  isSendingEmail = false;
  isModalOpen = false;
  errorMessage = '';

  /** Row ids currently mid status-update, for the per-row spinner. */
  pendingStatusIds = new Set<number>();
  /** Row ids that hit a send error, keyed to the inline error text shown in that panel. */
  sendErrors = new Map<number, string>();

  toasts: Toast[] = [];
  private toastCounter = 0;

  showDeleteModal = false;
  deleteTargetIds: number[] = [];
  deleteMessage = 'Permanently purge this compiled tracking profile record?';

  expandedAppId: number | null = null;

  selectedIds = new Set<number>();

  private searchSubject = new Subject<void>();
  private readonly DEBOUNCE_MS = 400;

  constructor(
    private appService: ApplicationsService,
    private skillsService: SkillsService,
    private categoriesService: CategoryService,
    private cvService: CvVariantsService,
    private templateService: TemplateService,
    private emailService: EmailService
  ) {}

  ngOnInit(): void {
    this.loadInitialWorkspaceData();

    this.searchSubject.pipe(debounceTime(this.DEBOUNCE_MS)).subscribe(() => {
      this.currentPage = 0;
      this.expandedAppId = null;
      this.loadApplicationsPage();
    });
  }

  ngOnDestroy(): void {
    this.searchSubject.complete();
  }

  // ── Filters ────────────────────────────────────────────────────────────────

  get hasActiveFilters(): boolean {
    return !!this.filterStatus || !!this.filterKeyword.trim();
  }

  onFilterInput(): void {
    // If the search box is cleared, reload immediately
    if (!this.filterKeyword.trim()) {
      this.currentPage = 0;
      this.expandedAppId = null;
      this.loadApplicationsPage();
      return;
    }

    // Otherwise debounce while typing
    this.searchSubject.next();
  }

  clearFilters(): void {
    this.filterKeyword = '';
    this.filterStatus = '';
    this.currentPage = 0;
    this.expandedAppId = null;
    this.loadApplicationsPage();
  }

  // ── Sorting ────────────────────────────────────────────────────────────────

  onSortChange(column: SortableColumn): void {
    if (this.sortBy === column) {
      this.direction = this.direction === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortBy = column;
      this.direction = 'asc';
    }
    this.currentPage = 0;
    this.loadApplicationsPage();
  }

  sortIndicator(column: SortableColumn): string {
    if (this.sortBy !== column) return '';
    return this.direction === 'asc' ? '↑' : '↓';
  }

  // ── Data loading ───────────────────────────────────────────────────────────

  loadInitialWorkspaceData(): void {
    this.isLoading = true;
    this.errorMessage = '';

    forkJoin({
      applications: this.appService.getAllApplications(
        this.currentPage,
        this.pageSize,
        this.sortBy,
        this.direction,
        this.filterStatus || undefined,
        this.filterKeyword || undefined
      ),
      skills: this.skillsService.getAllSkills(0, 100),
      categories: this.categoriesService.getAllCategories(),
      cvVariants: this.cvService.getAllCvVariants(0, 100),
      templates: this.templateService.getAllTemplates(0, 100),
    }).subscribe({
      next: (result) => {
        this.appPage = result.applications;
        const meta = getPageMeta(result.applications);
        this.currentPage = meta.number;
        this.appTotalPages = meta.totalPages;
        this.availableSkills = result.skills.content;
        this.availableCategories = result.categories;
        this.availableCvVariants = result.cvVariants.content;
        this.availableTemplates = result.templates.content;
        this.isLoading = false;
      },
      error: (err) => {
        this.errorMessage =
          err.error?.message || 'Error loading workspace data.';
        this.isLoading = false;
      },
    });
  }

  loadApplicationsPage(): void {
    // Only show the big skeleton on the very first load for a given view;
    // subsequent refreshes (filter, sort, page) use a lighter inline indicator
    // so the filter bar and layout don't jump around.
    const isFirstLoad = !this.appPage;
    if (isFirstLoad) {
      this.isLoading = true;
    } else {
      this.isRefreshing = true;
    }

    this.appService
      .getAllApplications(
        this.currentPage,
        this.pageSize,
        this.sortBy,
        this.direction,
        this.filterStatus || undefined,
        this.filterKeyword || undefined
      )
      .subscribe({
        next: (page) => {
          this.appPage = page;
          const meta = getPageMeta(page);
          this.currentPage = meta.number;
          this.appTotalPages = meta.totalPages;
          this.isLoading = false;
          this.isRefreshing = false;
          this.selectedIds.clear();
        },
        error: (err) => {
          this.errorMessage =
            err.error?.message || 'Could not fetch applications.';
          this.isLoading = false;
          this.isRefreshing = false;
        },
      });
  }

  // ── Pagination ─────────────────────────────────────────────────────────────

  onPageChange(newPage: number): void {
    this.currentPage = newPage;
    this.expandedAppId = null;
    this.loadApplicationsPage();
  }

  // ── Row events ─────────────────────────────────────────────────────────────

  onTogglePanel(appId: number): void {
    this.expandedAppId = this.expandedAppId === appId ? null : appId;
  }

  /**
   * Optimistically updates the row's status in place instead of reloading the
   * whole page, so a quick status change doesn't cause a layout flicker or
   * lose scroll position. Rolls back and shows a toast if the request fails.
   */
  onUpdateStatus(id: number, status: string): void {
    const app = this.appPage?.content.find((a) => a.id === id);
    if (!app) return;

    const previousStatus = app.status;
    app.status = status;
    this.pendingStatusIds.add(id);

    this.appService
      .patchApplicationStatusOrNotes(id, status, undefined)
      .subscribe({
        next: () => {
          this.pendingStatusIds.delete(id);
          this.pushToast('success', `Status updated to ${status}.`);
        },
        error: (err) => {
          app.status = previousStatus;
          this.pendingStatusIds.delete(id);
          this.pushToast(
            'error',
            err.error?.message || 'Could not update status.'
          );
        },
      });
  }

  onSaveNotes(appId: number, notes: string): void {
    this.appService
      .patchApplicationStatusOrNotes(appId, undefined, notes)
      .subscribe({
        next: () => {
          const app = this.appPage?.content.find((a) => a.id === appId);
          if (app) app.notes = notes;
          this.pushToast('success', 'Notes saved.');
        },
        error: (err) =>
          this.pushToast(
            'error',
            err.error?.message || 'Could not save notes.'
          ),
      });
  }

  onSendEmail(app: ApplicationResponseDto): void {
    if (!app.recipientEmail) {
      this.sendErrors.set(app.id, 'Cannot send: recipient email is missing.');
      return;
    }

    this.isSendingEmail = true;
    this.sendErrors.delete(app.id);

    this.emailService
      .sendEmail({
        recipientEmail: app.recipientEmail,
        subject: app.generatedSubject,
        body: app.generatedBody,
        cvVariantId: app.cvVariantId ? Number(app.cvVariantId) : undefined,
        applicationId: app.id,
      })
      .subscribe({
        next: (msg) => {
          this.pushToast('success', msg || 'Email sent!');
          this.onUpdateStatus(app.id, 'SENT');
          this.isSendingEmail = false;
        },
        error: (err) => {
          const message = err.error?.message || 'Email delivery failed.';
          this.sendErrors.set(app.id, message);
          this.isSendingEmail = false;
        },
      });
  }

  sendErrorFor(appId: number): string {
    return this.sendErrors.get(appId) || '';
  }

  onCopyBody(text: string): void {
    navigator.clipboard
      .writeText(text)
      .then(() => this.pushToast('success', 'Copied to clipboard.'))
      .catch(() => this.pushToast('error', 'Could not copy to clipboard.'));
  }

  // ── Bulk selection ─────────────────────────────────────────────────────────

  toggleSelect(id: number): void {
    if (this.selectedIds.has(id)) {
      this.selectedIds.delete(id);
    } else {
      this.selectedIds.add(id);
    }
  }

  get allVisibleSelected(): boolean {
    const content = this.appPage?.content ?? [];
    return content.length > 0 && content.every((a) => this.selectedIds.has(a.id));
  }

  toggleSelectAll(): void {
    const content = this.appPage?.content ?? [];
    if (this.allVisibleSelected) {
      content.forEach((a) => this.selectedIds.delete(a.id));
    } else {
      content.forEach((a) => this.selectedIds.add(a.id));
    }
  }

  clearSelection(): void {
    this.selectedIds.clear();
  }

  bulkMarkSent(): void {
    const ids = Array.from(this.selectedIds);
    if (!ids.length) return;

    const requests = ids.map((id) =>
      this.appService.patchApplicationStatusOrNotes(id, 'SENT', undefined)
    );

    forkJoin(requests).subscribe({
      next: () => {
        this.pushToast('success', `Marked ${ids.length} application(s) as sent.`);
        this.loadApplicationsPage();
      },
      error: (err) =>
        this.pushToast(
          'error',
          err.error?.message || 'Could not update some applications.'
        ),
    });
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  onDelete(id: number): void {
    this.deleteTargetIds = [id];
    this.deleteMessage = 'Permanently purge this compiled tracking profile record?';
    this.showDeleteModal = true;
  }

  onBulkDeleteClick(): void {
    const ids = Array.from(this.selectedIds);
    if (!ids.length) return;
    this.deleteTargetIds = ids;
    this.deleteMessage = `Permanently purge ${ids.length} selected application(s)?`;
    this.showDeleteModal = true;
  }

  onConfirmDelete(): void {
    const ids = this.deleteTargetIds;
    if (!ids.length) return;

    this.showDeleteModal = false;

    const requests = ids.map((id) => this.appService.deleteApplication(id));

    forkJoin(requests).subscribe({
      next: () => {
        this.pushToast(
          'success',
          ids.length > 1 ? `${ids.length} applications deleted.` : 'Application deleted.'
        );

        if (this.expandedAppId !== null && ids.includes(this.expandedAppId)) {
          this.expandedAppId = null;
        }
        ids.forEach((id) => this.selectedIds.delete(id));

        this.loadApplicationsPage();
      },
      error: (err) =>
        this.pushToast('error', err.error?.message || 'Could not delete.'),
    });
  }

  onCancelDelete(): void {
    this.showDeleteModal = false;
    this.deleteTargetIds = [];
  }

  // ── Modal ──────────────────────────────────────────────────────────────────

  openCreateModal(): void {
    this.isModalOpen = true;
  }

  closeModal(): void {
    this.isModalOpen = false;
    this.errorMessage = '';
  }

  @ViewChild(ApplicationPopupComponent)
  popupRef?: ApplicationPopupComponent;

  onCreateSubmit(payload: ApplicationCreateDto): void {
    this.isLoading = true;

    this.appService.createApplication(payload).subscribe({
      next: (created) => {
        this.pushToast('success', 'Application created successfully!');
        this.isModalOpen = false;
        this.expandedAppId = created.id;
        this.loadApplicationsPage();
        this.isLoading = false;
      },
      error: (err) => {
        this.isLoading = false;
        this.popupRef?.setError(
          err.error?.message || 'Failed to create application.'
        );
      },
    });
  }

  // ── Toasts ─────────────────────────────────────────────────────────────────

  private pushToast(type: Toast['type'], message: string): void {
    const id = ++this.toastCounter;
    this.toasts.push({ id, type, message });
    setTimeout(() => this.dismissToast(id), 4000);
  }

  dismissToast(id: number): void {
    this.toasts = this.toasts.filter((t) => t.id !== id);
  }
}
