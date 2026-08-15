import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';

import { ApplicationPresetService } from '../../../services/application-preset.service';
import { SkillsService } from '../../../services/skills.service';
import { CvVariantsService } from 'src/app/services/cv-variants.service';
import { TemplateService } from '../../../services/template.service';

import { PaginationComponent } from '../../common/pagination/pagination.component';
import { SkeletonComponent } from '../../common/skeleton/skeleton.components';
import { ToastService } from '../../common/toast/toast.service';

import {
  Page,
  getPageMeta,
  Skill,
  Category,
  CvVariantDto,
  TemplateDto,
} from 'src/app/models';
import {
  ApplicationPresetDto,
  ApplicationPresetCreateDto,
} from 'src/app/models/application_preset.model';
import { CategoryService } from 'src/app/services/category.service';
import { PresetPopupComponent } from '../application-preset-popup/preset-popup.component';
import { PresetDetailsPanelComponent } from '../preset-details/preset-details-panel.component';

type PresetSortableColumn = 'name' | 'jobTitle' | 'language';

interface LanguageOption {
  value: string;
  label: string;
}

@Component({
  selector: 'app-preset-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    PaginationComponent,
    SkeletonComponent,
    PresetPopupComponent,
    PresetDetailsPanelComponent,
  ],
  templateUrl: './preset-list.component.html',
})
export class PresetListComponent implements OnInit {
  /** Emits the chosen preset when the user clicks "Send" on a row. */
  @Output() send = new EventEmitter<ApplicationPresetDto>();

  presetPage?: Page<ApplicationPresetDto>;
  currentPage = 0;
  pageSize = 10;
  sortBy: PresetSortableColumn = 'name';
  direction: 'asc' | 'desc' = 'asc';
  totalPages = 0;

  keyword = '';
  languageFilter = '';
  isLoading = false;

  languageOptions: LanguageOption[] = [
    { label: 'All', value: '' },
    { label: 'English', value: 'EN' },
    { label: 'French', value: 'FR' },
  ];

  // ─── Create/Edit popup state ─────────────────────────────────────────────

  showPopup = false;
  isSubmittingPreset = false;
  selectedPresetForEdit: ApplicationPresetDto | null = null;

  availableSkills: Skill[] = [];
  availableCategories: Category[] = [];
  availableCvVariants: CvVariantDto[] = [];
  availableTemplates: TemplateDto[] = [];
  isLoadingPopupData = false;
  private popupDataLoaded = false;

  // ─── Inline details-panel state ─────────────────────────────────────────

  /** Id of the preset whose details row is currently expanded, or null if none. */
  expandedPresetId: number | null = null;

  constructor(
    private presetService: ApplicationPresetService,
    private skillsService: SkillsService,
    private categoriesService: CategoryService,
    private cvVariantsService: CvVariantsService,
    private templateService: TemplateService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.loadPresetsPage();
  }

  get hasActiveFilters(): boolean {
    return !!this.keyword.trim() || !!this.languageFilter;
  }

  loadPresetsPage(): void {
    this.isLoading = true;

    this.presetService
      .getAllPresets(
        this.currentPage,
        this.pageSize,
        this.sortBy,
        this.direction,
        this.keyword || undefined,
        this.languageFilter || undefined
      )
      .subscribe({
        next: (page) => {
          this.presetPage = page;
          const meta = getPageMeta(page);
          this.currentPage = meta.number;
          this.totalPages = meta.totalPages;
          this.isLoading = false;
        },
        error: (err) => {
          this.toastService.error(
            err.error?.message || 'Could not load presets.'
          );
          this.isLoading = false;
        },
      });
  }

  onFilterInput(): void {
    this.currentPage = 0;
    this.loadPresetsPage();
  }

  clearFilters(): void {
    this.keyword = '';
    this.languageFilter = '';
    this.currentPage = 0;
    this.loadPresetsPage();
  }

  onSortChange(column: PresetSortableColumn): void {
    if (this.sortBy === column) {
      this.direction = this.direction === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortBy = column;
      this.direction = 'asc';
    }
    this.currentPage = 0;
    this.loadPresetsPage();
  }

  sortIndicator(column: PresetSortableColumn): string {
    if (this.sortBy !== column) return '↕';
    return this.direction === 'asc' ? '↑' : '↓';
  }

  isActiveSort(column: PresetSortableColumn): boolean {
    return this.sortBy === column;
  }

  onPageChange(newPage: number): void {
    this.currentPage = newPage;
    this.loadPresetsPage();
  }

  onSend(preset: ApplicationPresetDto): void {
    this.send.emit(preset);
  }

  onDelete(preset: ApplicationPresetDto): void {
    if (!confirm(`Delete preset "${preset.name}"?`)) return;

    this.presetService.deletePreset(preset.id).subscribe({
      next: () => {
        this.toastService.success('Preset deleted.');
        if (this.expandedPresetId === preset.id) {
          this.expandedPresetId = null;
        }
        this.loadPresetsPage();
      },
      error: (err) =>
        this.toastService.error(
          err.error?.message || 'Could not delete preset.'
        ),
    });
  }

  // ─── Create/Edit popup wiring ───────────────────────────────────────────

  openCreatePopup(): void {
    this.selectedPresetForEdit = null;
    this.showPopup = true;
    if (!this.popupDataLoaded) {
      this.loadPopupReferenceData();
    }
  }

  openEditPopup(preset: ApplicationPresetDto): void {
    this.selectedPresetForEdit = preset;
    this.showPopup = true;
    if (!this.popupDataLoaded) {
      this.loadPopupReferenceData();
    }
  }

  closePopup(): void {
    if (this.isSubmittingPreset) return;
    this.showPopup = false;
    this.selectedPresetForEdit = null;
  }

  private loadPopupReferenceData(): void {
    this.isLoadingPopupData = true;

    forkJoin({
      skills: this.skillsService.getAllSkills(0, 100),
      categories: this.categoriesService.getAllCategories(),
      cvVariants: this.cvVariantsService.getAllCvVariants(0, 100),
      templates: this.templateService.getAllTemplates(0, 100),
    }).subscribe({
      next: ({ skills, categories, cvVariants, templates }) => {
        this.availableSkills = skills.content;
        this.availableCategories = categories;
        this.availableCvVariants = cvVariants.content;
        this.availableTemplates = templates.content;
        this.isLoadingPopupData = false;
        this.popupDataLoaded = true;
      },
      error: (err) => {
        this.toastService.error(
          err.error?.message || 'Could not load preset options.'
        );
        this.isLoadingPopupData = false;
        this.showPopup = false;
        this.selectedPresetForEdit = null;
      },
    });
  }

  onPresetSubmit(dto: ApplicationPresetCreateDto): void {
    this.isSubmittingPreset = true;

    const request$ = this.selectedPresetForEdit
      ? this.presetService.updatePreset(this.selectedPresetForEdit.id, dto)
      : this.presetService.createPreset(dto);

    request$.subscribe({
      next: () => {
        this.isSubmittingPreset = false;
        this.showPopup = false;
        this.toastService.success(
          this.selectedPresetForEdit
            ? 'Preset updated successfully.'
            : 'Preset created successfully.'
        );
        this.selectedPresetForEdit = null;
        this.currentPage = 0;
        this.loadPresetsPage();
      },
      error: (err) => {
        this.isSubmittingPreset = false;
        this.toastService.error(
          err.error?.message ||
            (this.selectedPresetForEdit
              ? 'Could not update preset.'
              : 'Could not create preset.')
        );
      },
    });
  }

  // ─── Inline details-panel wiring ────────────────────────────────────────

  toggleDetails(preset: ApplicationPresetDto): void {
    this.expandedPresetId =
      this.expandedPresetId === preset.id ? null : preset.id;
  }

  isPresetExpanded(preset: ApplicationPresetDto): boolean {
    return this.expandedPresetId === preset.id;
  }

  onNotesSaved(event: { presetId: number; notes: string }): void {
    const preset = this.presetPage?.content.find(
      (p) => p.id === event.presetId
    );
    if (!preset) return;

    const dto: ApplicationPresetCreateDto = {
      name: preset.name,
      jobTitle: preset.jobTitle,
      language: preset.language,
      templateId: preset.templateId,
      cvVariantId: preset.cvVariantId,
      skillIds: preset.skillIds,
      notes: event.notes,
    };

    this.presetService.updatePreset(preset.id, dto).subscribe({
      next: (updated) => {
        preset.notes = updated.notes ?? event.notes;
      },
      error: (err) => {
        this.toastService.error(err.error?.message || 'Could not save notes.');
        preset.notes = preset.notes;
      },
    });
  }
}
