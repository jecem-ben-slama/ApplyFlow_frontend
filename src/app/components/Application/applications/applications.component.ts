import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, Subject, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

import { ApplicationsService } from '../../../services/applications.service';
import { SkillsService } from '../../../services/skills.service';
import { CvVariantsService } from '../../../services/cv-variants.service';
import { TemplateService } from '../../../services/template.service';
import { EmailService } from '../../../services/email.service';
import { ApplicationActionService } from '../../../services/application-action.service';

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
import { Router } from '@angular/router';
import { TourService } from 'src/app/services/tour.service';
import {
  getApplicationsFillSteps,
  getApplicationsSteps,
} from 'src/app/core/tour';

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

  activeTab: 'all' | 'compiled' | 'presets' = 'all';
  selectedPreset: ApplicationPresetDto | null = null;
  filtersOpen = false;

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

  sendingEmailIds = new Set<number>();
  pendingStatusIds = new Set<number>();
  sendErrors = new Map<number, string>();

  isModalOpen = false;
  errorMessage = '';
  showDeleteModal = false;
  deleteTargetIds: number[] = [];
  deleteMessage = 'Permanently purge this compiled tracking profile record?';
  expandedAppId: number | null = null;

  private searchSubject = new Subject<void>();
  private searchSubscription?: Subscription;
  private listRequest?: Subscription;
  private referenceDataLoaded = false;
  private referenceDataLoading = false;
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
    private actionService: ApplicationActionService,
    private toastService: ToastService,
    private tourService: TourService,
    private router: Router
  ) {}
  ngAfterViewInit(): void {
    // Direct request from Profile ("start tour here"), passed via router
    // navigation state rather than TourService.isActive — that flag is
    // shared with the separate mid-chain case below and can't tell the two
    // apart on its own. history.state survives the navigation and is still
    // readable here once this component has mounted.
    if (history.state?.tourTarget === 'applications') {
      // Consume it so browser back/forward into this history entry later
      // doesn't unexpectedly re-trigger the fill tour.
      history.replaceState({ ...history.state, tourTarget: null }, '');

      // Defer to the next macrotask so Angular's change-detection pass has
      // fully painted the DOM before Driver.js measures #tour-application-add-btn
      // and positions its first popover. Without this, .drive() can compute
      // the popover position against a not-yet-laid-out element, and it only
      // "fixes itself" once the user clicks Next/Previous and forces Driver.js
      // to recompute. A microtask (Promise.resolve().then) is NOT sufficient
      // here — same reasoning as maybeStartTour() in skills.component.ts.
      setTimeout(() => {
        this.tourService.run(
          getApplicationsFillSteps(this.tourService, this.router)
        );
      }, 0);
      return;
    }

    // If a tour is already running (e.g. we've just been navigated here
    // mid-flow from the skills step, which already queued
    // getApplicationsFillSteps), do NOT stomp on it with the intro step.
    if (this.tourService.isActive) {
      return;
    }

    // Only kick off the intro/welcome tour on a genuinely fresh visit
    // that hasn't completed the tour before.
    if (!localStorage.getItem('applyflow_tour_completed')) {
      this.tourService.start();
      setTimeout(() => {
        this.tourService.run(
          getApplicationsSteps(this.tourService, this.router)
        );
      }, 0);
    }
  }
  ngOnInit(): void {
    this.loadInitialWorkspaceData();

    this.searchSubscription = this.searchSubject
      .pipe(debounceTime(this.DEBOUNCE_MS))
      .subscribe(() => {
        this.currentPage = 0;
        this.expandedAppId = null;
        this.loadApplicationsPage();
      });
  }

  ngOnDestroy(): void {
    this.searchSubscription?.unsubscribe();
    this.listRequest?.unsubscribe();
    this.searchSubject.complete();
  }

  switchTab(tab: 'all' | 'compiled' | 'presets'): void {
    if (this.activeTab === tab) return;
    this.activeTab = tab;
    this.expandedAppId = null;

    if (tab === 'presets') return;

    this.currentPage = 0;
    this.filterStatus = '';
    this.loadApplicationsPage();
  }

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

  trackByApp(_index: number, app: ApplicationResponseDto): number {
    return app.id;
  }

  loadInitialWorkspaceData(): void {
    this.isLoading = true;
    this.errorMessage = '';

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
        next: (applications) => {
          this.appPage = this.postProcessApplications(applications);
          const meta = getPageMeta(this.appPage);
          this.currentPage = meta.number;
          this.appTotalPages = meta.totalPages;
          this.isLoading = false;
        },
        error: (err) => {
          this.errorMessage = err.error?.message || 'Error loading data.';
          this.isLoading = false;
        },
      });
  }

  private loadReferenceData(): void {
    if (this.referenceDataLoaded || this.referenceDataLoading) return;

    this.referenceDataLoading = true;
    forkJoin({
      skills: this.skillsService.getAllSkills(0, 100),
      categories: this.categoriesService.getAllCategories(),
      cvVariants: this.cvService.getAllCvVariants(0, 100),
      templates: this.templateService.getAllTemplates(0, 100),
    }).subscribe({
      next: (result) => {
        this.availableSkills = result.skills.content;
        this.availableCategories = result.categories;
        this.availableCvVariants = result.cvVariants.content;
        this.availableTemplates = result.templates.content;
        this.referenceDataLoaded = true;
        this.referenceDataLoading = false;
      },
      error: () => {
        this.referenceDataLoading = false;
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

    this.listRequest?.unsubscribe();
    this.listRequest = this.appService
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

  onPageChange(newPage: number): void {
    this.currentPage = newPage;
    this.expandedAppId = null;
    this.loadApplicationsPage();
  }

  onTogglePanel(appId: number): void {
    this.expandedAppId = this.expandedAppId === appId ? null : appId;
  }

  onUpdateStatus(id: number, status: string): void {
    const app = this.appPage?.content.find((a) => a.id === id);
    if (!app) return;

    const previousStatus = app.status;
    app.status = status;
    this.pendingStatusIds.add(id);

    this.actionService.queueStatusChange(
      id,
      status,
      () => {
        this.pendingStatusIds.delete(id);
        this.toastService.success(`Status updated to ${status}.`);
        if (status === 'COMPILED' && this.activeTab === 'all') {
          this.loadApplicationsPage();
        } else if (
          previousStatus === 'COMPILED' &&
          status !== 'COMPILED' &&
          this.activeTab === 'compiled'
        ) {
          this.activeTab = 'all';
          this.loadApplicationsPage();
        }
      },
      (err) => {
        app.status = previousStatus;
        this.pendingStatusIds.delete(id);
        this.toastService.error(
          err.error?.message || 'Could not update status.'
        );
      }
    );

    this.toastService.info(
      `Updating status to ${status}…`,
      this.actionService.UNDO_WINDOW_MS,
      {
        label: 'Undo',
        onClick: () => this.cancelStatusUpdate(id, previousStatus),
        onDismiss: () => this.actionService.executeStatusChangeNow(id),
      }
    );
  }

  private cancelStatusUpdate(id: number, previousStatus: string): void {
    this.actionService.cancelStatusChange(id);
    this.pendingStatusIds.delete(id);

    const app = this.appPage?.content.find((a) => a.id === id);
    if (app) {
      app.status = previousStatus;
    }

    this.toastService.info('Status change cancelled.');
  }

  onSaveNotes(appId: number, notes: string): void {
    const app = this.appPage?.content.find((a) => a.id === appId);
    const previousNotes = app ? app.notes : '';
    if (app) app.notes = notes;

    this.toastService.success('Notes saved.');

    this.appService
      .patchApplicationStatusOrNotes(appId, undefined, notes)
      .subscribe({
        next: () => {},
        error: (err) => {
          if (app) app.notes = previousNotes;
          this.toastService.error(
            err.error?.message || 'Could not save notes.'
          );
        },
      });
  }

  onSendEmail(app: ApplicationResponseDto): void {
    if (!app.recipientEmail) {
      this.sendErrors.set(app.id, 'Cannot send: recipient email is missing.');
      return;
    }

    this.sendErrors.delete(app.id);
    this.sendingEmailIds.add(app.id);

    const wasCompiled = app.status === 'COMPILED';
    app.status = 'SENT';

    this.queueSend(app, wasCompiled, false);
  }

  private queueSend(
    app: ApplicationResponseDto,
    wasCompiled: boolean,
    isCompileFlow: boolean
  ): void {
    this.actionService.queueEmailSend(
      app,
      wasCompiled,
      isCompileFlow,
      (msg) => {
        this.sendingEmailIds.delete(app.id);
        this.toastService.success(
          msg ||
            (isCompileFlow
              ? 'Application compiled and email sent!'
              : 'Email sent successfully!')
        );
        app.status = 'SENT';
        if (wasCompiled && this.activeTab === 'compiled') {
          this.activeTab = 'all';
        }
        this.loadApplicationsPage();
      },
      (err) => {
        this.sendingEmailIds.delete(app.id);
        app.status = wasCompiled ? 'COMPILED' : 'VIEWED';
        const message = err.error?.message || 'Email delivery failed.';
        this.sendErrors.set(app.id, message);
        this.toastService.error(message);
      }
    );

    this.toastService.info(
      'Sending email…',
      this.actionService.UNDO_WINDOW_MS,
      {
        label: 'Undo',
        onClick: () => this.cancelSend(app.id, isCompileFlow, wasCompiled),
        onDismiss: () => this.actionService.executeEmailSendNow(app.id),
      }
    );
  }

  private cancelSend(
    appId: number,
    isCompileFlow: boolean,
    wasCompiled: boolean = false
  ): void {
    this.actionService.cancelEmailSend(appId);
    this.sendingEmailIds.delete(appId);

    const app = this.appPage?.content.find((a) => a.id === appId);
    if (app) {
      app.status = wasCompiled
        ? 'COMPILED'
        : app.status === 'SENT'
        ? 'VIEWED'
        : app.status;
    }

    this.toastService.info(
      isCompileFlow
        ? 'Application compiled — email not sent.'
        : 'Send cancelled.'
    );
  }

  sendErrorFor(appId: number): string {
    return this.sendErrors.get(appId) || '';
  }

  isSending(appId: number): boolean {
    return this.sendingEmailIds.has(appId);
  }

  onCopyBody(text: string): void {
    navigator.clipboard
      .writeText(text)
      .then(() => this.toastService.success('Copied to clipboard.'))
      .catch(() => this.toastService.error('Could not copy to clipboard.'));
  }

  onDelete(id: number): void {
    if (this.sendingEmailIds.has(id) || this.pendingStatusIds.has(id)) return;

    this.deleteTargetIds = [id];
    this.deleteMessage =
      'Permanently delete this application — it cannot be undone';
    this.showDeleteModal = true;
  }

  onConfirmDelete(): void {
    const ids = this.deleteTargetIds;
    if (!ids.length) return;

    this.showDeleteModal = false;

    ids.forEach((id) => {
      this.actionService.cancelEmailSend(id);
      this.actionService.cancelStatusChange(id);
    });

    if (this.appPage) {
      this.appPage.content = this.appPage.content.filter(
        (a) => !ids.includes(a.id)
      );
      this.appPage.totalElements! -= ids.length;
    }

    if (this.expandedAppId !== null && ids.includes(this.expandedAppId)) {
      this.expandedAppId = null;
    }

    this.toastService.success('Application deleted successfully.');

    const requests = ids.map((id) => this.appService.deleteApplication(id));

    forkJoin(requests).subscribe({
      next: () => {
        this.loadApplicationsPage();
      },
      error: (err) => {
        this.toastService.error(err.error?.message || 'Could not delete.');
        this.loadApplicationsPage();
      },
    });
  }

  onCancelDelete(): void {
    this.showDeleteModal = false;
    this.deleteTargetIds = [];
  }

  onSendFromPreset(preset: ApplicationPresetDto): void {
    this.loadReferenceData();
    this.selectedPreset = preset;
    this.isModalOpen = true;
  }

  openCreateModal(): void {
    this.loadReferenceData();
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
    this.isModalOpen = false;
    this.selectedPreset = null;

    const tempId = Date.now();
    const optimisticApp: ApplicationResponseDto = {
      id: tempId,
      companyName: payload.companyName || 'New Company',
      jobTitle: payload.jobTitle || 'New Position',
      status: 'COMPILED',
      dateApplied: new Date().toISOString(),
      recipientEmail: payload.recipientEmail,
      generatedSubject: '',
      generatedBody: '',
      notes: payload.notes || '',
      language: payload.language || 'EN',
      userId: 0,
      skillIds: [],
    };

    if (this.appPage) {
      this.appPage.content = [optimisticApp, ...this.appPage.content];
      this.appPage.totalElements! += 1;
    } else {
      this.appPage = {
        content: [optimisticApp],
        totalElements: 1,
        totalPages: 1,
        size: this.pageSize,
        number: 0,
        page: {
          totalElements: 1,
          totalPages: 1,
          number: 0,
          size: this.pageSize,
        },
      };
    }

    this.toastService.success('Application created successfully!');
    this.activeTab = 'compiled';
    this.expandedAppId = tempId;

    this.appService.createApplication(payload).subscribe({
      next: (created) => {
        if (this.appPage) {
          this.appPage.content = this.appPage.content.map((a) =>
            a.id === tempId ? created : a
          );
          if (this.expandedAppId === tempId) {
            this.expandedAppId = created.id;
          }
        }
      },
      error: (err) => {
        if (this.appPage) {
          this.appPage.content = this.appPage.content.filter(
            (a) => a.id !== tempId
          );
          this.appPage.totalElements! -= 1;
        }
        this.toastService.error(
          err.error?.message || 'Failed to create application.'
        );
      },
    });
  }

  onCreateAndSendSubmit(payload: ApplicationCreateDto): void {
    this.isModalOpen = false;
    this.selectedPreset = null;

    const tempId = Date.now();
    const optimisticApp: ApplicationResponseDto = {
      id: tempId,
      companyName: payload.companyName || 'New Company',
      jobTitle: payload.jobTitle || 'New Position',
      status: 'SENT',
      dateApplied: new Date().toISOString(),
      recipientEmail: payload.recipientEmail,
      generatedSubject: '',
      generatedBody: '',
      notes: payload.notes || '',
      language: payload.language || 'EN',
      userId: 0,
      skillIds: [],
    };

    if (this.appPage) {
      this.appPage.content = [optimisticApp, ...this.appPage.content];
      this.appPage.totalElements! += 1;
    } else {
      this.appPage = {
        content: [optimisticApp],
        totalElements: 1,
        totalPages: 1,
        size: this.pageSize,
        number: 0,
        page: {
          totalElements: 1,
          totalPages: 1,
          number: 0,
          size: this.pageSize,
        },
      };
    }

    this.activeTab = 'compiled';
    this.expandedAppId = tempId;

    this.appService.createApplication(payload).subscribe({
      next: (created) => {
        if (this.appPage) {
          this.appPage.content = this.appPage.content.map((a) =>
            a.id === tempId ? created : a
          );
          if (this.expandedAppId === tempId) {
            this.expandedAppId = created.id;
          }
        }
        this.sendEmailAfterCompile(created);
      },
      error: (err) => {
        if (this.appPage) {
          this.appPage.content = this.appPage.content.filter(
            (a) => a.id !== tempId
          );
          this.appPage.totalElements! -= 1;
        }
        this.toastService.error(
          err.error?.message || 'Failed to create application.'
        );
      },
    });
  }

  private sendEmailAfterCompile(app: ApplicationResponseDto): void {
    if (!app.recipientEmail) {
      this.sendErrors.set(app.id, 'Cannot send: recipient email is missing.');
      this.toastService.error(
        'Application compiled, but cannot send: recipient email is missing.'
      );
      return;
    }

    this.sendErrors.delete(app.id);
    this.sendingEmailIds.add(app.id);
    this.queueSend(app, true, true);
  }

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

  getCvVariantName(cvVariantId: number | string | null | undefined): string {
    if (!cvVariantId) return '';
    const variant = this.availableCvVariants.find(
      (v) => v.id === Number(cvVariantId)
    );
    return variant?.name ? variant.name : `CV Variant #${cvVariantId}`;
  }
}
