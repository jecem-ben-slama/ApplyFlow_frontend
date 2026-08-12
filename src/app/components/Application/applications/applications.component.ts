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
import { ToastContainerComponent } from '../../common/toast/toast-container.component';
import { ToastService } from '../../common/toast/toast.service';

type SortableColumn = 'companyName' | 'jobTitle' | 'dateApplied' | 'status';



interface StatusOption {
  value: string;
  label: string;
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
    ToastContainerComponent,
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

  /** Controls the collapsible filter panel on mobile. Always visible on desktop. */
  filtersOpen = false;

  /** Used to render the mobile status pill chips in the filter bar. */
  statusOptions: StatusOption[] = [
    { value: '', label: 'All' },
    { value: 'COMPILED', label: 'Compiled' },
    { value: 'SENT', label: 'Sent' },
    { value: 'INTERVIEWING', label: 'Interviewing' },
    { value: 'REJECTED', label: 'Rejected' },
  ];

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
  showDeleteModal = false;
  deleteTargetIds: number[] = [];
  deleteMessage = 'Permanently purge this compiled tracking profile record?';

  expandedAppId: number | null = null;

  private searchSubject = new Subject<void>();
  private readonly DEBOUNCE_MS = 400;

  /** Palette used to derive a consistent avatar color per company name on mobile cards. */
  private readonly avatarPalette = [
    'bg-indigo-500',
    'bg-emerald-500',
    'bg-amber-500',
    'bg-rose-500',
    'bg-sky-500',
    'bg-violet-500',
  ];

  /** Color classes for the mobile status pill/select, keyed by status value. */
  private readonly statusClassMap: Record<string, string> = {
    COMPILED:
      'bg-slate-100 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
    SENT: 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900',
    INTERVIEWING:
      'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900',
    REJECTED:
      'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900',
  };

  constructor(
    private appService: ApplicationsService,
    private skillsService: SkillsService,
    private categoriesService: CategoryService,
    private cvService: CvVariantsService,
    private templateService: TemplateService,
    private emailService: EmailService,
    private toastService: ToastService,
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

  /** Number of active filters, shown as a badge on the mobile filter toggle. */
  get activeFilterCount(): number {
    return (this.filterKeyword.trim() ? 1 : 0) + (this.filterStatus ? 1 : 0);
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
        },
        error: (err) => {
          this.errorMessage =
            err.error?.message || 'Could not fetch applications.';
          this.toastService.error(this.errorMessage);
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
          this.toastService.success(`Status updated to ${status}.`);
        },
        error: (err) => {
          app.status = previousStatus;
          this.pendingStatusIds.delete(id);
          this.toastService.error(
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
          this.toastService.success('Notes saved.');
        },
        error: (err) =>
          this.toastService.error(
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
          this.toastService.success( msg || 'Email sent!');
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
      .then(() => this.toastService.success( 'Copied to clipboard.'))
      .catch(() => this.toastService.error('Could not copy to clipboard.'));
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  onDelete(id: number): void {
    this.deleteTargetIds = [id];
    this.deleteMessage =
      'Permanently delete this application  it cannot be undone';
    this.showDeleteModal = true;
  }

  onConfirmDelete(): void {
    const ids = this.deleteTargetIds;
    if (!ids.length) return;

    this.showDeleteModal = false;

    const requests = ids.map((id) => this.appService.deleteApplication(id));

    forkJoin(requests).subscribe({
      next: () => {
        this.toastService.success(
          
          ids.length > 1
            ? `${ids.length} applications deleted.`
            : 'Application deleted.'
        );

        if (this.expandedAppId !== null && ids.includes(this.expandedAppId)) {
          this.expandedAppId = null;
        }

        this.loadApplicationsPage();
      },
      error: (err) =>
        this.toastService.error('error', err.error?.message || 'Could not delete.'),
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
        this.toastService.success( 'Application created successfully!');
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


  // ── Mobile card helpers ──────────────────────────────────────────────────

  /** Status pill/select color classes for the mobile card view. */
  getStatusClasses(status: string): string {
    return this.statusClassMap[status] ?? this.statusClassMap['COMPILED'];
  }

  /** Deterministic avatar background color derived from the company name. */
  avatarColor(name: string): string {
    const hash = (name || '')
      .split('')
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return this.avatarPalette[hash % this.avatarPalette.length];
  }

  /** Human-friendly relative date used on mobile cards (e.g. "3d ago"). */
  timeAgo(date: string | Date | null | undefined): string {
    if (!date) return 'N/A';

    const diffMs = Date.now() - new Date(date).getTime();
    const days = Math.floor(diffMs / 86400000);

    if (days <= 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 30) return `${days}d ago`;

    const months = Math.floor(days / 30);
    return months < 12 ? `${months}mo ago` : `${Math.floor(months / 12)}y ago`;
  }
}
