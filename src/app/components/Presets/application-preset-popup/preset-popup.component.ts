import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  OnDestroy,
  Output,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Subject, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { Skill, CvVariantDto, TemplateDto, Category } from '../../../models';
import {
  ApplicationPresetCreateDto,
  ApplicationPresetDto,
} from 'src/app/models/application_preset.model';
import { ToastService } from '../../common/toast/toast.service';
// Adjust this import path to match where toast.service.ts actually lives relative to this component.

type ValidatedField = 'name' | 'templateId' | 'language';

const FIELD_LIMITS = {
  name: 100,
  jobTitle: 150,
} as const;

@Component({
  selector: 'app-preset-popup',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './preset-popup.component.html',
})
export class PresetPopupComponent implements OnInit, OnChanges, OnDestroy {
  constructor(
    private sanitizer: DomSanitizer,
    private toastService: ToastService
  ) {}

  @Input() availableSkills: Skill[] = [];
  @Input() availableCategories: Category[] = [];
  @Input() availableCvVariants: CvVariantDto[] = [];
  @Input() availableTemplates: TemplateDto[] = [];
  @Input() isLoading = false;
  @Input() presetToEdit: ApplicationPresetDto | null = null;

  @Output() close = new EventEmitter<void>();
  @Output() presetSubmit = new EventEmitter<ApplicationPresetCreateDto>();
  @Output() draftSave = new EventEmitter<ApplicationPresetCreateDto>();

  formModel: ApplicationPresetCreateDto = {
    name: '',
    jobTitle: '',
    language: 'en',
    notes: '',
    cvVariantId: null,
    templateId: null,
    skillIds: [],
  };

  readonly fieldLimits = FIELD_LIMITS;

  selectedTemplatePreview?: TemplateDto;
  errorMessage = '';
  copied = false;
  selectedCategoryId: number | null = null;

  private touched: Partial<Record<ValidatedField, boolean>> = {};
  private submitAttempted = false;

  get submitAttemptedOnce(): boolean {
    return this.submitAttempted;
  }

  private static readonly FIELD_ORDER: ValidatedField[] = [
    'name',
    'templateId',
    'language',
  ];

  // ---------------------------------------------------------------------
  // Draft persistence (localStorage)
  // ---------------------------------------------------------------------

  /** localStorage key used to persist an unsaved draft across reloads/tab switches. */
  private readonly draftStorageKey = 'presetPopup.draft';

  private draftTrigger = new Subject<void>();
  private draftSub?: Subscription;

  /**
   * True while an existing preset is loaded for editing. Mirrors `isEditing`
   * on the template form: an edited preset's values are never part of the
   * pending "new preset" draft, so drafts are never restored into,
   * persisted from, or cleared while `presetToEdit` is set.
   */
  private get isEditing(): boolean {
    return !!this.presetToEdit;
  }

  ngOnInit(): void {
    this.initFormState();

    // Covers both possible hosting patterns: if this component is created
    // fresh per open (like the application popup), this is the moment it
    // opened. If it's a persistent instance instead, this only covers the
    // very first open — see ngOnChanges below for later re-opens.
    if (!this.isEditing) {
      this.restoreDraft();
    }

    this.draftSub = this.draftTrigger.pipe(debounceTime(600)).subscribe(() => {
      if (!this.isEditing) {
        this.persistDraft();
        this.draftSave.emit({ ...this.formModel });
      }
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['presetToEdit'] || changes['availableTemplates']) {
      this.initFormState();
    }

    const presetChange = changes['presetToEdit'];
    if (presetChange && !presetChange.firstChange && !this.presetToEdit) {
      // presetToEdit just went back to null — i.e. the popup was reopened
      // (or switched over) for a *new* preset. If this component instance
      // is reused rather than destroyed between opens, ngOnInit won't fire
      // again, so re-attempt a draft restore here too; otherwise the draft
      // would only reappear after a full page refresh.
      this.restoreDraft();
    }
  }

  ngOnDestroy(): void {
    this.draftSub?.unsubscribe();
  }

  /** Call whenever the user edits the form, so the draft gets (debounced) persisted. */
  notifyDraft(): void {
    this.draftTrigger.next();
  }

  private persistDraft(): void {
    try {
      localStorage.setItem(
        this.draftStorageKey,
        JSON.stringify(this.formModel)
      );
    } catch {
      // localStorage unavailable (private browsing, quota, etc.) — fail silently
    }
  }

  private restoreDraft(): void {
    try {
      const raw = localStorage.getItem(this.draftStorageKey);
      if (!raw) return;

      const draft: Partial<ApplicationPresetCreateDto> = JSON.parse(raw);
      const formIsEmpty =
        !this.formModel.name &&
        !this.formModel.jobTitle &&
        !this.formModel.notes &&
        !this.formModel.templateId &&
        !this.formModel.skillIds?.length;

      // Only restore into an empty form so we never clobber data initFormState just set
      if (formIsEmpty) {
        this.formModel = { ...this.formModel, ...draft };

        // Re-run the same side effects a manual selection would trigger, so
        // the template preview / language match / CV compatibility all stay
        // in sync with the restored values.
        if (this.formModel.templateId) {
          this.selectedTemplatePreview = this.availableTemplates.find(
            (t) => t.id === Number(this.formModel.templateId)
          );
        }
        this.resetCvVariantIfIncompatible();

        this.toastService.info('Unsaved draft restored.');
      }
    } catch {
      // Corrupted draft — ignore and start fresh
    }
  }

  private clearDraft(): void {
    try {
      localStorage.removeItem(this.draftStorageKey);
    } catch {}
  }

  // ---------------------------------------------------------------------

  private initFormState(): void {
    if (this.presetToEdit) {
      this.formModel = {
        name: this.presetToEdit.name ?? '',
        jobTitle: this.presetToEdit.jobTitle ?? '',
        language: this.presetToEdit.language ?? 'en',
        notes: this.presetToEdit.notes ?? '',
        cvVariantId: this.presetToEdit.cvVariantId ?? null,
        templateId: this.presetToEdit.templateId ?? null,
        skillIds: this.presetToEdit.skillIds
          ? [...this.presetToEdit.skillIds]
          : [],
      };
    } else {
      this.formModel = {
        name: '',
        jobTitle: '',
        language: 'en',
        notes: '',
        cvVariantId: null,
        templateId: null,
        skillIds: [],
      };
    }

    this.submitAttempted = false;
    this.touched = {};
    this.errorMessage = '';

    if (this.formModel.templateId) {
      this.selectedTemplatePreview = this.availableTemplates.find(
        (t) => t.id === Number(this.formModel.templateId)
      );
    } else {
      this.selectedTemplatePreview = undefined;
    }
  }

  // ─── Skill helpers ────────────────────────────────────────────────────────

  get filteredSkills(): Skill[] {
    if (this.selectedCategoryId === null) return [];
    return this.availableSkills.filter(
      (skill) => skill.categoryId === this.selectedCategoryId
    );
  }

  getSkillName(id: number): string {
    return (
      this.availableSkills.find((s) => s.id === id)?.name ?? `Skill #${id}`
    );
  }

  toggleSkillSelection(skillId: number): void {
    const index = this.formModel.skillIds.indexOf(skillId);
    if (index > -1) {
      this.formModel.skillIds.splice(index, 1);
    } else {
      this.formModel.skillIds.push(skillId);
    }
    this.notifyDraft();
  }

  clearCategorySelection(): void {
    this.selectedCategoryId = null;
  }

  // ─── Template helpers ─────────────────────────────────────────────────────

  onTemplateChange(): void {
    this.markTouched('templateId');

    if (!this.formModel.templateId) {
      this.selectedTemplatePreview = undefined;
      this.notifyDraft();
      return;
    }
    this.selectedTemplatePreview = this.availableTemplates.find(
      (t) => t.id === Number(this.formModel.templateId)
    );

    if (this.selectedTemplatePreview?.language) {
      const templateLang = this.selectedTemplatePreview.language
        .trim()
        .toLowerCase();
      const matchedLang = this.availableLanguages.find(
        (lang) => lang.trim().toLowerCase() === templateLang
      );
      if (matchedLang) {
        this.formModel.language = matchedLang;
        this.markTouched('language');
      }
    }

    this.resetCvVariantIfIncompatible();
    this.notifyDraft();
  }

  // ─── Language helpers ──────────────────────────────────────────────────────

  get availableLanguages(): string[] {
    const seen = new Map<string, string>();
    const add = (lang?: string) => {
      const value = (lang || '').trim();
      if (!value) return;
      const key = value.toLowerCase();
      if (!seen.has(key)) seen.set(key, value);
    };

    ['en', 'fr'].forEach(add);
    this.availableTemplates.forEach((t) => add(t.language));
    this.availableCvVariants.forEach((cv) => add(cv.language));

    return Array.from(seen.values()).sort((a, b) => a.localeCompare(b));
  }

  private sameLanguage(a?: string | null, b?: string | null): boolean {
    return (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();
  }

  onLanguageChange(): void {
    this.markTouched('language');
    this.resetCvVariantIfIncompatible();
    this.notifyDraft();
  }

  // ─── CV variant helpers ────────────────────────────────────────────────────

  get filteredCvVariants(): CvVariantDto[] {
    if (!this.formModel.language) return this.availableCvVariants;
    return this.availableCvVariants.filter((cv) =>
      this.sameLanguage(cv.language, this.formModel.language)
    );
  }

  onCvVariantChange(): void {
    this.notifyDraft();
  }

  private resetCvVariantIfIncompatible(): void {
    if (!this.formModel.cvVariantId) return;
    const stillValid = this.filteredCvVariants.some(
      (cv) => cv.id === this.formModel.cvVariantId
    );
    if (!stillValid) {
      this.formModel.cvVariantId = null;
    }
  }

  // ─── Live email preview ────────────────────────────────────────────────────

  private static readonly COMPANY_PLACEHOLDER = '[Company]';

  private get previewPosition(): string {
    return this.formModel.jobTitle?.trim() || '[Position]';
  }

  hasPreviewContent(): boolean {
    return !!this.selectedTemplatePreview?.bodyTemplate;
  }

  getRenderedSubject(): string {
    if (this.selectedTemplatePreview?.subjectTemplate) {
      return this.applySubjectPlaceholders(
        this.selectedTemplatePreview.subjectTemplate
      );
    }
    const role = this.formModel.jobTitle;
    if (role) return `Application for ${role}`;
    return 'Job Application';
  }

  getRenderedSubjectHtml(): SafeHtml {
    const rawSubject = this.getRenderedSubject();

    const escape = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const highlight = (s: string) =>
      s
        ? `<span style="color:#3b82f6;font-weight:600">${escape(s)}</span>`
        : '';

    let html = escape(rawSubject);
    if (this.formModel.jobTitle) {
      html = html.replace(
        new RegExp(escape(this.formModel.jobTitle), 'gi'),
        highlight(this.formModel.jobTitle)
      );
    }

    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  getRenderedEmailBody(): string {
    if (!this.selectedTemplatePreview?.bodyTemplate) return '';
    return this.applyBodyPlaceholders(
      this.selectedTemplatePreview.bodyTemplate
    );
  }

  getWordCount(): number {
    return this.getRenderedEmailBody().trim().split(/\s+/).filter(Boolean)
      .length;
  }

  getRenderedEmailBodyHtml(): SafeHtml {
    if (!this.selectedTemplatePreview?.bodyTemplate) return '';

    const escape = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const highlight = (s: string) =>
      s
        ? `<span style="color:#3b82f6;font-weight:500">${escape(s)}</span>`
        : '';

    const company = PresetPopupComponent.COMPANY_PLACEHOLDER;
    const position = this.previewPosition;
    const bullets = this.buildSkillBullets();

    const skillPattern =
      /\{\{(skills_block|skills|skillbullets|skill_bullets)\}\}/gi;
    const hasSkillPlaceholder = skillPattern.test(
      this.selectedTemplatePreview.bodyTemplate
    );

    const bulletsHtml = bullets
      ? bullets
          .split('\n')
          .map((line) => highlight(line))
          .join('\n')
      : '';

    let html = escape(this.selectedTemplatePreview.bodyTemplate)
      .replace(/\{\{companyname\}\}/gi, highlight(company))
      .replace(/\{\{company\}\}/gi, highlight(company))
      .replace(/\{\{position\}\}/gi, highlight(position))
      .replace(/\{\{role\}\}/gi, highlight(position))
      .replace(/\{\{jobtitle\}\}/gi, highlight(position))
      .replace(/\{\{job_title\}\}/gi, highlight(position))
      .replace(/\{\{language\}\}/gi, highlight(this.formModel.language ?? ''))
      .replace(/\{\{notes\}\}/gi, highlight(this.formModel.notes ?? ''))
      .replace(
        /\{\{(skills_block|skills|skillbullets|skill_bullets)\}\}/gi,
        bulletsHtml
      );

    if (!hasSkillPlaceholder && bulletsHtml) {
      const lines = html.split('\n');
      const closingKeywords =
        /^(best|regards|sincerely|cordialement|yours|kind|merci|thank)/i;
      let insertAt = lines.length;
      for (let i = lines.length - 1; i >= 0; i--) {
        const stripped = lines[i].replace(/<[^>]+>/g, '').trim();
        if (stripped && closingKeywords.test(stripped)) {
          insertAt = i;
          break;
        }
      }
      lines.splice(insertAt, 0, '', bulletsHtml, '');
      html = lines.join('\n');
    }

    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  copyEmailToClipboard(): void {
    const text = `Subject: ${this.getRenderedSubject()}\n\n${this.getRenderedEmailBody()}`;
    navigator.clipboard.writeText(text).then(() => {
      this.copied = true;
      setTimeout(() => (this.copied = false), 2000);
    });
  }

  /**
   * Resolver exclusively for the subject template. Only handles position fields.
   */
  private applySubjectPlaceholders(template: string): string {
    const position = this.previewPosition;

    return template
      .replace(/\{\{position\}\}/gi, position)
      .replace(/\{\{role\}\}/gi, position)
      .replace(/\{\{jobtitle\}\}/gi, position)
      .replace(/\{\{job_title\}\}/gi, position);
  }

  /**
   * Resolver exclusively for the body template. Handles company, position, skills, and notes.
   */
  private applyBodyPlaceholders(template: string): string {
    const company = PresetPopupComponent.COMPANY_PLACEHOLDER;
    const position = this.previewPosition;
    const bullets = this.buildSkillBullets();

    const skillPlaceholderPattern =
      /\{\{(skills_block|skills|skillbullets|skill_bullets)\}\}/gi;
    const hasSkillsPlaceholder = skillPlaceholderPattern.test(template);

    let result = template
      .replace(/\{\{companyname\}\}/gi, company)
      .replace(/\{\{company\}\}/gi, company)
      .replace(/\{\{position\}\}/gi, position)
      .replace(/\{\{role\}\}/gi, position)
      .replace(/\{\{jobtitle\}\}/gi, position)
      .replace(/\{\{job_title\}\}/gi, position)
      .replace(/\{\{language\}\}/gi, this.formModel.language ?? '')
      .replace(/\{\{notes\}\}/gi, this.formModel.notes ?? '')
      .replace(
        /\{\{(skills_block|skills|skillbullets|skill_bullets)\}\}/gi,
        bullets
      );

    if (!hasSkillsPlaceholder && this.formModel.skillIds.length > 0) {
      const lines = result.split('\n');
      const closingKeywords =
        /^(best|regards|sincerely|cordialement|yours|kind|merci|thank)/i;
      let insertAt = lines.length;
      for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i].trim() && closingKeywords.test(lines[i].trim())) {
          insertAt = i;
          break;
        }
      }
      lines.splice(insertAt, 0, '', bullets, '');
      result = lines.join('\n');
    }

    return result;
  }

  private buildSkillBullets(): string {
    if (!this.formModel.skillIds.length) return '';
    return this.formModel.skillIds
      .map((id) => `• ${this.getSkillName(id)}`)
      .join('\n');
  }

  // ─── Modal ────────────────────────────────────────────────────────────────

  /** Wraps the close output so the persisted draft is cleared on explicit dismissal — but only when this wasn't an edit of an existing preset. */
  closeModal(): void {
    if (!this.isEditing) {
      this.clearDraft();
    }
    this.close.emit();
  }

  setError(message: string): void {
    this.errorMessage = message;
  }

  private focusField(field: ValidatedField): void {
    const el = document.getElementById(`preset-field-${field}`);
    if (el) {
      (el as HTMLElement).focus({ preventScroll: false });
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  // ─── Validation ─────────────────────────────────────────────────────────

  markTouched(field: ValidatedField): void {
    this.touched[field] = true;
  }

  private shouldShowError(field: ValidatedField): boolean {
    return this.submitAttempted || !!this.touched[field];
  }

  getFieldError(field: ValidatedField): string {
    if (!this.shouldShowError(field)) return '';

    switch (field) {
      case 'name': {
        const value = (this.formModel.name || '').trim();
        if (!value) return 'Preset name is required.';
        if (value.length > FIELD_LIMITS.name)
          return `Preset name must be under ${FIELD_LIMITS.name} characters.`;
        return '';
      }
      case 'templateId':
        return this.formModel.templateId
          ? ''
          : 'Select a template for this preset.';
      case 'language':
        return this.formModel.language ? '' : 'Select a language.';
      default:
        return '';
    }
  }

  hasFieldError(field: ValidatedField): boolean {
    return !!this.getFieldError(field);
  }

  isFormValid(): boolean {
    return (
      !!this.formModel.name?.trim() &&
      this.formModel.name.trim().length <= FIELD_LIMITS.name &&
      !!this.formModel.templateId &&
      !!this.formModel.language
    );
  }

  // ─── Submit ───────────────────────────────────────────────────────────────

  onSubmit(): void {
    if (this.isLoading) return;
    this.errorMessage = '';
    this.submitAttempted = true;

    const firstInvalidField = PresetPopupComponent.FIELD_ORDER.find(
      (field) => !!this.getFieldError(field)
    );

    if (firstInvalidField) {
      this.setError('Please fix the highlighted fields before saving.');
      this.focusField(firstInvalidField);
      return;
    }

    const payload: ApplicationPresetCreateDto = {
      ...this.formModel,
      name: (this.formModel.name ?? '').trim(),
      jobTitle: (this.formModel.jobTitle ?? '').trim() || null,
      notes: (this.formModel.notes ?? '').trim() || null,
      templateId: Number(this.formModel.templateId),
      cvVariantId: this.formModel.cvVariantId
        ? Number(this.formModel.cvVariantId)
        : null,
    };

    // Only clear the draft when this was a genuine new-preset draft — saving
    // an edit to an existing preset has no relationship to it.
    if (!this.isEditing) {
      this.clearDraft();
    }

    this.presetSubmit.emit(payload);
  }
}
