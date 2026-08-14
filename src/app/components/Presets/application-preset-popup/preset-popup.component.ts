import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Skill, CvVariantDto, TemplateDto, Category } from '../../../models';
import {
  ApplicationPresetCreateDto,
  ApplicationPresetDto,
} from 'src/app/models/application_preset.model';

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
export class PresetPopupComponent implements OnInit, OnChanges {
  constructor(private sanitizer: DomSanitizer) {}

  @Input() availableSkills: Skill[] = [];
  @Input() availableCategories: Category[] = [];
  @Input() availableCvVariants: CvVariantDto[] = [];
  @Input() availableTemplates: TemplateDto[] = [];
  @Input() isLoading = false;
  @Input() presetToEdit: ApplicationPresetDto | null = null;

  @Output() close = new EventEmitter<void>();
  @Output() presetSubmit = new EventEmitter<ApplicationPresetCreateDto>();

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

  ngOnInit(): void {
    this.initFormState();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['presetToEdit'] || changes['availableTemplates']) {
      this.initFormState();
    }
  }

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
  }

  clearCategorySelection(): void {
    this.selectedCategoryId = null;
  }

  // ─── Template helpers ─────────────────────────────────────────────────────

  onTemplateChange(): void {
    this.markTouched('templateId');

    if (!this.formModel.templateId) {
      this.selectedTemplatePreview = undefined;
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
  }

  // ─── CV variant helpers ────────────────────────────────────────────────────

  get filteredCvVariants(): CvVariantDto[] {
    if (!this.formModel.language) return this.availableCvVariants;
    return this.availableCvVariants.filter((cv) =>
      this.sameLanguage(cv.language, this.formModel.language)
    );
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

  closeModal(): void {
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

    this.presetSubmit.emit(payload);
  }
}
