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
import { ApplicationPresetDto } from 'src/app/models/application_preset.model';
import { PresetListComponent } from '../../Presets/preset-list/preset-list.component';

type SortableColumn = 'companyName' | 'jobTitle' | 'dateApplied' | 'status';
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
    PresetListComponent,
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
  activeTab: 'all' | 'compiled' | 'presets' = 'all';

  /** The preset currently loaded into the popup, if opened via "Send" from the presets tab. */
  selectedPreset: ApplicationPresetDto | null = null;

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

  /**
   * Per-application "email currently sending" tracker, replacing the old
   * single global `isSendingEmail` boolean. A global flag made every row's
   * send button/spinner light up whenever *any* email was in flight, which
   * looked and behaved like the whole app was blocked. Tracking by id lets
   * every other row, tab, filter, and the create button stay fully usable
   * while one send is in progress.
   */
  sendingEmailIds = new Set<number>();

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

  switchTab(tab: 'all' | 'compiled' | 'presets'): void {
    if (this.activeTab === tab) return;
    this.activeTab = tab;
    this.expandedAppId = null;

    if (tab === 'presets') return;

    this.currentPage = 0;
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
        this.errorMessage = err.error?.message || 'Error loading data.';
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
          // If a delete (or filter change) emptied out the page we're
          // currently viewing but earlier pages still have content,
          // step back one page and re-fetch instead of showing a blank
          // list. Guards against currentPage=0 to avoid looping forever
          // on a genuinely empty result set.
          if (page.content.length === 0 && this.currentPage > 0) {
            this.currentPage -= 1;
            this.isLoading = false;
            this.isRefreshing = false;
            this.loadApplicationsPage();
            return;
          }

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

          if (status === 'COMPILED' && this.activeTab === 'all') {
            // Moved INTO 'Compiled' while looking at 'All' — it no longer
            // belongs in this list, reload to drop it.
            this.loadApplicationsPage();
          } else if (
            previousStatus === 'COMPILED' &&
            status !== 'COMPILED' &&
            this.activeTab === 'compiled'
          ) {
            // Moved OUT of 'Compiled' (e.g. a send sets it to 'SENT') while
            // looking at the 'Compiled' tab. That tab only ever queries
            // status=COMPILED, so simply reloading here would filter the
            // row straight out of view — the row (and its expanded panel)
            // would just vanish. Follow it over to 'All', where every
            // non-compiled status actually lives, then reload there.
            this.activeTab = 'all';
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

    this.sendingEmailIds.add(app.id);
    this.sendErrors.delete(app.id);

    const wasCompiled = app.status === 'COMPILED';

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
          this.sendingEmailIds.delete(app.id);

          // The backend already flips the status to SENT as part of
          // sending the email — don't PATCH it again from the client.
          // Reflect it locally so the UI is correct even before the
          // reload below comes back, and if we were viewing the
          // 'compiled' tab, follow the row to 'all' since it no longer
          // matches that tab's status=COMPILED filter.
          app.status = 'SENT';
          if (wasCompiled && this.activeTab === 'compiled') {
            this.activeTab = 'all';
          }
          this.loadApplicationsPage();
        },
        error: (err) => {
          const message = err.error?.message || 'Email delivery failed.';
          this.sendErrors.set(app.id, message);
          this.sendingEmailIds.delete(app.id);
        },
      });
  }

  sendErrorFor(appId: number): string {
    return this.sendErrors.get(appId) || '';
  }

  /** Per-application send state, used by row/panel bindings so only the row actually sending shows a spinner. */
  isSending(appId: number): boolean {
    return this.sendingEmailIds.has(appId);
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
        this.toastService.success('Application deleted successfully.');

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

  // ── Presets ────────────────────────────────────────────────────────────────

  /** "Send" emitted from <app-preset-list> — opens the existing popup pre-filled with everything but company/email. */
  onSendFromPreset(preset: ApplicationPresetDto): void {
    this.selectedPreset = preset;
    this.isModalOpen = true;
  }

  // ── Modal ──────────────────────────────────────────────────────────────────

  openCreateModal(): void {
    this.selectedPreset = null;
    this.isModalOpen = true;
  }

  closeModal(): void {
    this.isModalOpen = false;
    this.selectedPreset = null;
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
        this.selectedPreset = null;
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

  /** "Compile & Send" from the popup — creates the application, then immediately sends its email. */
  onCreateAndSendSubmit(payload: ApplicationCreateDto): void {
    this.isLoading = true;

    this.appService.createApplication(payload).subscribe({
      next: (created) => {
        this.isModalOpen = false;
        this.selectedPreset = null;
        this.isLoading = false; // unblocks the rest of the UI right away — the send below runs in the background
        this.sendEmailAfterCompile(created);
      },
      error: (err) => {
        this.isLoading = false;
        this.popupRef?.setError(
          err.error?.message || 'Failed to create application.'
        );
      },
    });
  }

  /**
   * Sends the email right after a "Compile & Send" creation. The backend
   * flips the application's status to SENT as part of sending the email,
   * so no client-side status patch happens here — we just follow the tab
   * and reload once the send resolves. Tracked per-id via
   * `sendingEmailIds` so the rest of the app stays fully usable while
   * this send is in flight.
   */
  private sendEmailAfterCompile(app: ApplicationResponseDto): void {
    this.activeTab = 'compiled';
    this.expandedAppId = app.id;
    // Show the compiled email immediately — same as "Compile Only" — instead
    // of waiting for the send round-trip before the list (and the expanded
    // email panel) appear.
    this.loadApplicationsPage();

    if (!app.recipientEmail) {
      this.sendErrors.set(app.id, 'Cannot send: recipient email is missing.');
      this.toastService.error(
        'Application compiled, but cannot send: recipient email is missing.'
      );
      return;
    }

    this.sendingEmailIds.add(app.id);
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
          this.sendingEmailIds.delete(app.id);
          this.toastService.success(
            msg || 'Application compiled and email sent!'
          );

          // The backend already flips the status to SENT as part of
          // sending the email — don't PATCH it again from the client.
          // The row is now SENT, not COMPILED, so the 'compiled' tab's
          // status=COMPILED filter would drop it on reload, collapsing
          // the panel out from under the user. Follow it to 'all', the
          // same destination every COMPILED → non-COMPILED transition
          // goes to.
          this.activeTab = 'all';
          this.loadApplicationsPage();
        },
        error: (err) => {
          this.sendingEmailIds.delete(app.id);
          this.sendErrors.set(
            app.id,
            err.error?.message || 'Email delivery failed.'
          );
          this.toastService.error(
            'Application compiled, but the email failed to send.'
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
