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

interface LanguageOption {
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
  filterLanguage = '';

  /** Tab control state */
  activeTab: 'all' | 'compiled' = 'all';

  /** Controls the collapsible filter panel on mobile. Always visible on desktop. */
  filtersOpen = false;

  /** Used to render the mobile status pill chips in the filter bar. */
  statusOptions = [
    { label: 'All', value: '' },
    { label: 'Sent', value: 'SENT' },
    { label: 'Viewed', value: 'VIEWED' },
    { label: 'Responded', value: 'RESPONDED' },
    { label: 'Interview Scheduled', value: 'INTERVIEW_SCHEDULED' },
    { label: 'Interviewing', value: 'INTERVIEWING' },
    { label: 'Offer', value: 'OFFER' },
    { label: 'Rejected', value: 'REJECTED' },
    { label: 'Ghosted', value: 'GHOSTED' },
    { label: 'Withdrawn', value: 'WITHDRAWN' },
  ];

  /** Used to render both the desktop select and the mobile language pill chips. */
  languageOptions: LanguageOption[] = [
    { label: 'All', value: '' },
    { label: 'English', value: 'EN' },
    { label: 'French', value: 'FR' },
  ];

  availableSkills: Skill[] = [];
  availableCategories: Category[] = [];
  availableCvVariants: CvVariantDto[] = [];
  availableTemplates: TemplateDto[] = [];

  isLoading = false;
  isRefreshing = false;
  isSendingEmail = false;
  isModalOpen = false;
  errorMessage = '';

  pendingStatusIds = new Set<number>();
  sendErrors = new Map<number, string>();
  showDeleteModal = false;
  deleteTargetIds: number[] = [];
  deleteMessage = 'Permanently purge this compiled tracking profile record?';

  expandedAppId: number | null = null;

  private searchSubject = new Subject<void>();
  private readonly DEBOUNCE_MS = 400;

  private readonly avatarPalette = [
    'bg-indigo-500',
    'bg-emerald-500',
    'bg-amber-500',
    'bg-rose-500',
    'bg-sky-500',
    'bg-violet-500',
  ];

  private readonly statusClassMap: Record<string, string> = {
    COMPILED:
      'bg-slate-100 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
    SENT: 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900',
    VIEWED:
      'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-900',
    RESPONDED:
      'bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-900',
    INTERVIEW_SCHEDULED:
      'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900',
    INTERVIEWING:
      'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900',
    OFFER:
      'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900',
    REJECTED:
      'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900',
    GHOSTED:
      'bg-zinc-100 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700',
    WITHDRAWN:
      'bg-stone-100 dark:bg-stone-800/50 text-stone-600 dark:text-stone-400 border-stone-200 dark:border-stone-700',
  };

  constructor(
    private appService: ApplicationsService,
    private skillsService: SkillsService,
    private categoriesService: CategoryService,
    private cvService: CvVariantsService,
    private templateService: TemplateService,
    private emailService: EmailService,
    private toastService: ToastService
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

  // ── Tabs ───────────────────────────────────────────────────────────────────

  switchTab(tab: 'all' | 'compiled'): void {
    if (this.activeTab === tab) return;
    this.activeTab = tab;
    this.currentPage = 0;
    this.expandedAppId = null;
    this.filterStatus = ''; // Reset status filter when switching tabs
    this.loadApplicationsPage();
  }

  // ── Filters ────────────────────────────────────────────────────────────────

  get hasActiveFilters(): boolean {
    return (
      !!this.filterStatus ||
      !!this.filterKeyword.trim() ||
      !!this.filterLanguage
    );
  }

  get activeFilterCount(): number {
    return (
      (this.filterKeyword.trim() ? 1 : 0) +
      (this.filterStatus ? 1 : 0) +
      (this.filterLanguage ? 1 : 0)
    );
  }

  onFilterInput(): void {
    if (!this.filterKeyword.trim()) {
      this.currentPage = 0;
      this.expandedAppId = null;
      this.loadApplicationsPage();
      return;
    }
    this.searchSubject.next();
  }

  clearFilters(): void {
    this.filterKeyword = '';
    this.filterStatus = '';
    this.filterLanguage = '';
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
    if (this.sortBy !== column) return '↕';
    return this.direction === 'asc' ? '↑' : '↓';
  }

  isActiveSort(column: SortableColumn): boolean {
    return this.sortBy === column;
  }

  // ── Data loading ───────────────────────────────────────────────────────────

  loadInitialWorkspaceData(): void {
    this.isLoading = true;
    this.errorMessage = '';

    const effectiveStatus =
      this.activeTab === 'compiled'
        ? 'COMPILED'
        : this.filterStatus || undefined;

    forkJoin({
      applications: this.appService.getAllApplications(
        this.currentPage,
        this.pageSize,
        this.sortBy,
        this.direction,
        effectiveStatus,
        this.filterKeyword || undefined,
        this.filterLanguage || undefined
      ),
      skills: this.skillsService.getAllSkills(0, 100),
      categories: this.categoriesService.getAllCategories(),
      cvVariants: this.cvService.getAllCvVariants(0, 100),
      templates: this.templateService.getAllTemplates(0, 100),
    }).subscribe({
      next: (result) => {
        this.appPage = this.postProcessApplications(result.applications);
        const meta = getPageMeta(this.appPage);
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
    const isFirstLoad = !this.appPage;
    if (isFirstLoad) {
      this.isLoading = true;
    } else {
      this.isRefreshing = true;
    }

    const effectiveStatus =
      this.activeTab === 'compiled'
        ? 'COMPILED'
        : this.filterStatus || undefined;

    this.appService
      .getAllApplications(
        this.currentPage,
        this.pageSize,
        this.sortBy,
        this.direction,
        effectiveStatus,
        this.filterKeyword || undefined,
        this.filterLanguage || undefined
      )
      .subscribe({
        next: (page) => {
          this.appPage = this.postProcessApplications(page);
          const meta = getPageMeta(this.appPage);
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

  /** Ensures that if we are on the 'all' tab, 'COMPILED' records are filtered out locally just in case backend returns them. */
  private postProcessApplications(
    page: Page<ApplicationResponseDto>
  ): Page<ApplicationResponseDto> {
    if (this.activeTab === 'all') {
      const filteredContent = page.content.filter(
        (app) => app.status !== 'COMPILED'
      );
      return {
        ...page,
        content: filteredContent,
        totalElements: page.totalElements,
      };
    }
    return page;
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
          if (
            (status === 'COMPILED' && this.activeTab === 'all') ||
            (previousStatus === 'COMPILED' && this.activeTab === 'compiled')
          ) {
            this.loadApplicationsPage();
          }
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
          this.toastService.success(msg || 'Email sent!');
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
      .then(() => this.toastService.success('Copied to clipboard.'))
      .catch(() => this.toastService.error('Could not copy to clipboard.'));
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  onDelete(id: number): void {
    this.deleteTargetIds = [id];
    this.deleteMessage =
      'Permanently delete this application — it cannot be undone';
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
        this.toastService.error(err.error?.message || 'Could not delete.'),
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
        this.toastService.success('Application created successfully!');
        this.isModalOpen = false;
        this.activeTab = 'compiled';
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

  getStatusClasses(status: string): string {
    return this.statusClassMap[status] ?? this.statusClassMap['COMPILED'];
  }

  avatarColor(name: string): string {
    const hash = (name || '')
      .split('')
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return this.avatarPalette[hash % this.avatarPalette.length];
  }

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

  /** Resolves a CV variant name from the already-loaded list, avoiding an extra fetch per row/card. */
  getCvVariantName(cvVariantId: number | string | null | undefined): string {
    if (!cvVariantId) return '';
    const variant = this.availableCvVariants.find(
      (v) => v.id === Number(cvVariantId)
    );
    return variant?.name ? variant.name : `CV Variant #${cvVariantId}`;
  }
}
