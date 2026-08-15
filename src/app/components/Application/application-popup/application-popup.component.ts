import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import {
  ApplicationCreateDto,
  Skill,
  CvVariantDto,
  TemplateDto,
  Category,
} from '../../../models';
import { ApplicationPresetDto } from 'src/app/models/application_preset.model';

type ValidatedField =
  | 'templateId'
  | 'companyName'
  | 'jobTitle'
  | 'recipientEmail'
  | 'language';

const FIELD_LIMITS = {
  companyName: 100,
  jobTitle: 100,
} as const;

@Component({
  selector: 'app-application-popup',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './application-popup.component.html',
})
export class ApplicationPopupComponent implements OnInit {
  constructor(private sanitizer: DomSanitizer) {}
  @Input() availableSkills: Skill[] = [];
  @Input() availableCategories: Category[] = [];
  @Input() availableCvVariants: CvVariantDto[] = [];
  @Input() availableTemplates: TemplateDto[] = [];
  @Input() isLoading = false;
  /** When set (opened via "Send" from a preset), pre-fills the form on init. */
  @Input() prefillFromPreset: ApplicationPresetDto | null = null;

  @Output() close = new EventEmitter<void>();
  @Output() formSubmit = new EventEmitter<ApplicationCreateDto>();
  /** Emitted instead of `formSubmit` when the user picks "Compile & Send" — parent creates the application then sends the email right away. */
  @Output() formSubmitAndSend = new EventEmitter<ApplicationCreateDto>();

  formModel: ApplicationCreateDto = {
    companyName: '',
    jobTitle: '',
    recipientEmail: '',
    language: 'en',
    templateId: null as any,
    cvVariantId: null as any,
    userId: 0,
    skillIds: [],
    notes: '',
  };

  readonly fieldLimits = FIELD_LIMITS;

  selectedTemplatePreview?: TemplateDto;
  errorMessage = '';
  copied = false;
  selectedCategoryId: number | null = null;

  /** True after a first click without a CV — next click on the same button confirms and proceeds. */
  private pendingNoCvConfirmation = false;
  /** Which action (compile-only or compile & send) triggered the pending no-CV confirmation. */
  private pendingAction: 'compile' | 'send' | null = null;
  /** Which action is currently in flight, so each submit button shows its own loading label. */
  private lastSubmittedAction: 'compile' | 'send' | null = null;

  /** Public read used by the template to show the no-CV warning banner. */
  get noCvConfirmationPending(): boolean {
    return this.pendingNoCvConfirmation;
  }

  /** True when the "Compile Only" button is the one awaiting no-CV confirmation. */
  get isCompileConfirmationPending(): boolean {
    return this.pendingNoCvConfirmation && this.pendingAction === 'compile';
  }

  /** True when the "Compile & Send" button is the one awaiting no-CV confirmation. */
  get isSendConfirmationPending(): boolean {
    return this.pendingNoCvConfirmation && this.pendingAction === 'send';
  }

  /** True while a compile-only submission is in flight, for the compile button's own spinner/label. */
  get isCompileLoading(): boolean {
    return this.isLoading && this.lastSubmittedAction === 'compile';
  }

  /** True while a compile-and-send submission is in flight, for the send button's own spinner/label. */
  get isSendLoading(): boolean {
    return this.isLoading && this.lastSubmittedAction === 'send';
  }

  /** Tracks which fields the user has interacted with, so errors only show after blur/change. */
  private touched: Partial<Record<ValidatedField, boolean>> = {};
  /** Set true once the user attempts a submit — forces all field errors to show. */
  private submitAttempted = false;

  /** Public read of submitAttempted, used by the template to gate the submit-button disabled state. */
  get submitAttemptedOnce(): boolean {
    return this.submitAttempted;
  }

  private static readonly FIELD_ORDER: ValidatedField[] = [
    'templateId',
    'companyName',
    'jobTitle',
    'recipientEmail',
    'language',
  ];

  ngOnInit(): void {
    if (this.prefillFromPreset) {
      this.applyPreset(this.prefillFromPreset);
    }
  }

  // ─── Presets ──────────────────────────────────────────────────────────────

  /**
   * Pre-fills the form from a preset. Company name, job title, and recipient
   * email are intentionally left untouched — those are per-application and
   * are not part of a preset. Reuses onTemplateChange/resetCvVariantIfIncompatible
   * so the live preview, language matching, and CV compatibility checks all
   * stay in sync with what the user would get by picking these values manually.
   */
  private applyPreset(preset: ApplicationPresetDto): void {
    if (preset.templateId != null) {
      this.formModel.templateId = preset.templateId;
      this.onTemplateChange();
    }
    if (preset.jobTitle) {
      this.formModel.jobTitle = preset.jobTitle;
    }
    if (preset.language) {
      this.formModel.language = preset.language;
    }

    if (preset.cvVariantId != null) {
      this.formModel.cvVariantId = preset.cvVariantId;
    }
    // Re-check compatibility now that language + cvVariantId are both final.
    this.resetCvVariantIfIncompatible();

    if (preset.skillIds?.length) {
      this.formModel.skillIds = [...preset.skillIds];
    }

    if (preset.notes) {
      this.formModel.notes = preset.notes;
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

  /**
   * Returns strictly the skill's sentence in the application's current language
   * (French if `formModel.language` is French, English otherwise), falling
   * back to the other language's sentence, without ever prepending or including the skill name.
   */
  getSkillSentence(id: number): string {
    const skill = this.availableSkills.find((s) => s.id === id);
    if (!skill) return `Skill #${id}`;

    const isFrench = (this.formModel.language || '')
      .trim()
      .toLowerCase()
      .startsWith('fr');

    const preferred = isFrench ? skill.sentenceFr : skill.sentenceEn;
    const fallback = isFrench ? skill.sentenceEn : skill.sentenceFr;

    return preferred?.trim() || fallback?.trim() || '';
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
    this.pendingNoCvConfirmation = false;
    this.pendingAction = null;
    if (!this.formModel.templateId) {
      this.selectedTemplatePreview = undefined;
      return;
    }
    this.selectedTemplatePreview = this.availableTemplates.find(
      (t) => t.id === Number(this.formModel.templateId)
    );

    // Match template language safely against available languages (case-insensitive)
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

  /**
   * Languages available to pick from. Built from whatever templates and CV
   * variants actually use (so a template's language is never missing from
   * the dropdown), de-duplicated case-insensitively, plus a couple of
   * sane defaults so the field is never empty.
   */
  get availableLanguages(): string[] {
    const seen = new Map<string, string>(); // lowercase key -> original casing
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

  private sameLanguage(a?: string, b?: string): boolean {
    return (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();
  }

  onLanguageChange(): void {
    this.markTouched('language');
    this.pendingNoCvConfirmation = false;
    this.pendingAction = null;
    this.resetCvVariantIfIncompatible();
  }

  // ─── CV variant helpers ────────────────────────────────────────────────────

  /** Only CV variants matching the application's current language are selectable. */
  get filteredCvVariants(): CvVariantDto[] {
    if (!this.formModel.language) return this.availableCvVariants;
    return this.availableCvVariants.filter((cv) =>
      this.sameLanguage(cv.language, this.formModel.language)
    );
  }

  onCvVariantChange(): void {
    this.pendingNoCvConfirmation = false;
    this.pendingAction = null;
  }

  /** Clears the selected CV variant if it no longer matches the current language. */
  private resetCvVariantIfIncompatible(): void {
    if (!this.formModel.cvVariantId) return;
    const stillValid = this.filteredCvVariants.some(
      (cv) => cv.id === this.formModel.cvVariantId
    );
    if (!stillValid) {
      this.formModel.cvVariantId = null as any;
    }
  }

  /**
   * Preview shown inside the template card — substitutes form values into the
   * raw bodyTemplate so the user sees exactly how placeholders resolve.
   */
  getLiveTemplateBodyPreview(): string {
    if (!this.selectedTemplatePreview?.bodyTemplate) return '';
    return this.applyBodyPlaceholders(
      this.selectedTemplatePreview.bodyTemplate
    );
  }

  // ─── Live email preview ──────────────────────────────────────────────────

  /**
   * Returns true only when enough data exists to show a meaningful preview.
   * The preview panel starts empty until a template is selected.
   */
  hasPreviewContent(): boolean {
    return !!this.selectedTemplatePreview?.bodyTemplate;
  }

  /**
   * Rendered subject line text plain.
   */
  getRenderedSubject(): string {
    if (this.selectedTemplatePreview?.subjectTemplate) {
      return this.applySubjectPlaceholders(
        this.selectedTemplatePreview.subjectTemplate
      );
    }
    const role = this.formModel.jobTitle;
    const company = this.formModel.companyName;
    if (role && company) return `Application for ${role} at ${company}`;
    if (role) return `Application for ${role}`;
    if (company) return `Application at ${company}`;
    return 'Job Application';
  }

  /**
   * Rendered subject highlighted with inline dynamic colors.
   */
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
    if (this.formModel.companyName) {
      html = html.replace(
        new RegExp(escape(this.formModel.companyName), 'gi'),
        highlight(this.formModel.companyName)
      );
    }

    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  /**
   * Rendered body from the selected template's bodyTemplate.
   * Placeholders are substituted with current form values.
   * Skills are injected as a bullet list wherever {{skills}} / {{skillbullets}} appears;
   * if no such placeholder exists in the template, bullets are appended before the sign-off.
   */
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

  /**
   * Returns the email body as sanitized HTML where injected values (company,
   * position, skills) are wrapped in a blue span so they stand out from the
   * static template text.
   */
  getRenderedEmailBodyHtml(): SafeHtml {
    if (!this.selectedTemplatePreview?.bodyTemplate) return '';

    const escape = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const highlight = (s: string) =>
      s
        ? `<span style="color:#3b82f6;font-weight:500">${escape(s)}</span>`
        : '';

    const company = this.formModel.companyName || '';
    const position = this.formModel.jobTitle || '';
    const bullets = this.buildSkillBullets();

    const skillPattern =
      /\{\{(skills_block|skills|skillbullets|skill_bullets)\}\}/gi;
    const hasSkillPlaceholder = skillPattern.test(
      this.selectedTemplatePreview.bodyTemplate
    );

    // Build highlighted bullets HTML (one per line)
    const bulletsHtml = bullets
      ? bullets
          .split('\n')
          .map((line) => highlight(line))
          .join('\n')
      : '';

    let html = escape(this.selectedTemplatePreview.bodyTemplate)
      // company
      .replace(/\{\{companyname\}\}/gi, highlight(company))
      .replace(/\{\{company\}\}/gi, highlight(company))
      // position
      .replace(/\{\{position\}\}/gi, highlight(position))
      .replace(/\{\{role\}\}/gi, highlight(position))
      .replace(/\{\{jobtitle\}\}/gi, highlight(position))
      .replace(/\{\{job_title\}\}/gi, highlight(position))
      // misc
      .replace(/\{\{language\}\}/gi, highlight(this.formModel.language ?? ''))
      .replace(/\{\{notes\}\}/gi, highlight(this.formModel.notes ?? ''))
      // skills (all variants including skills_block)
      .replace(
        /\{\{(skills_block|skills|skillbullets|skill_bullets)\}\}/gi,
        bulletsHtml
      );

    // If no placeholder exists but skills are selected, inject before sign-off
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

  // ─── Clipboard ────────────────────────────────────────────────────────────

  copyEmailToClipboard(): void {
    const text = `Subject: ${this.getRenderedSubject()}\n\n${this.getRenderedEmailBody()}`;
    navigator.clipboard.writeText(text).then(() => {
      this.copied = true;
      setTimeout(() => (this.copied = false), 2000);
    });
  }

  // ─── Modal ────────────────────────────────────────────────────────────────

  closeModal(): void {
    this.close.emit();
  }

  setError(message: string): void {
    this.errorMessage = message;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /** Moves focus to the first field that failed validation, matching its `id="field-<name>"`. */
  private focusField(field: ValidatedField): void {
    const el = document.getElementById(`field-${field}`);
    if (el) {
      (el as HTMLElement).focus({ preventScroll: false });
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  // ─── Validation ─────────────────────────────────────────────────────────

  /** Call on (blur)/(change) for a given field so its error can appear. */
  markTouched(field: ValidatedField): void {
    this.touched[field] = true;
  }

  /** Whether a field's error should currently be displayed. */
  private shouldShowError(field: ValidatedField): boolean {
    return this.submitAttempted || !!this.touched[field];
  }

  private isValidEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  }

  /**
   * Returns the current error message for a field, or '' if valid or not yet
   * shown. Used by the template to render inline messages and red borders.
   */
  getFieldError(field: ValidatedField): string {
    if (!this.shouldShowError(field)) return '';

    switch (field) {
      case 'templateId':
        return this.formModel.templateId
          ? ''
          : 'Select a template to build the email from.';

      case 'companyName': {
        const value = (this.formModel.companyName || '').trim();
        if (!value) return 'Company name is required.';
        if (value.length > FIELD_LIMITS.companyName)
          return `Company name must be under ${FIELD_LIMITS.companyName} characters.`;
        return '';
      }

      case 'jobTitle': {
        const value = (this.formModel.jobTitle || '').trim();
        if (!value) return 'Position is required.';
        if (value.length > FIELD_LIMITS.jobTitle)
          return `Position must be under ${FIELD_LIMITS.jobTitle} characters.`;
        return '';
      }

      case 'recipientEmail': {
        const value = (this.formModel.recipientEmail || '').trim();
        if (!value) return 'Recipient email is required.';
        if (!this.isValidEmail(value)) return 'Enter a valid email address.';
        return '';
      }

      case 'language':
        return this.formModel.language ? '' : 'Select a language.';

      default:
        return '';
    }
  }

  hasFieldError(field: ValidatedField): boolean {
    return !!this.getFieldError(field);
  }

  /**
   * Pure validity check — does not touch display state. Safe to call from
   * the template (e.g. to disable the submit button) without side effects.
   */
  isFormValid(): boolean {
    return (
      !!this.formModel.templateId &&
      !!this.formModel.companyName?.trim() &&
      this.formModel.companyName.trim().length <= FIELD_LIMITS.companyName &&
      !!this.formModel.jobTitle?.trim() &&
      this.formModel.jobTitle.trim().length <= FIELD_LIMITS.jobTitle &&
      !!this.formModel.recipientEmail?.trim() &&
      this.isValidEmail(this.formModel.recipientEmail) &&
      !!this.formModel.language
    );
  }

  // ─── Submit ───────────────────────────────────────────────────────────────

  /** "Compile Only" button — creates the application without sending an email. */
  onSubmit(): void {
    this.processSubmit('compile');
  }

  /** "Compile & Send" button — creates the application and sends the email immediately. */
  onSubmitAndSend(): void {
    this.processSubmit('send');
  }

  /**
   * Shared submit pipeline for both actions. Validates the form, then gates
   * on a missing CV: the first click for a given action just warns (via
   * `pendingAction`/`pendingNoCvConfirmation`) and the matching button's
   * label flips to its "Anyway" state; a second click on that same button
   * proceeds. Switching template/language/CV variant clears the pending
   * state so a stale confirmation can never silently apply to new data.
   */
  private processSubmit(action: 'compile' | 'send'): void {
    if (this.isLoading) return;
    this.errorMessage = '';
    this.submitAttempted = true;

    const firstInvalidField = ApplicationPopupComponent.FIELD_ORDER.find(
      (field) => !!this.getFieldError(field)
    );

    if (firstInvalidField) {
      this.setError('Please fix the highlighted fields before compiling.');
      this.focusField(firstInvalidField);
      return;
    }

    const alreadyConfirmedForThisAction =
      this.pendingNoCvConfirmation && this.pendingAction === action;

    if (!this.formModel.cvVariantId && !alreadyConfirmedForThisAction) {
      this.pendingNoCvConfirmation = true;
      this.pendingAction = action;
      return;
    }

    // Normalise {{companyname}} → {{company}} before emitting
    const activeTemplate = this.availableTemplates.find(
      (t) => t.id === Number(this.formModel.templateId)
    );
    if (activeTemplate) {
      if (activeTemplate.bodyTemplate) {
        activeTemplate.bodyTemplate = activeTemplate.bodyTemplate.replace(
          /\{\{companyname\}\}/gi,
          '{{company}}'
        );
      }
      if (activeTemplate.subjectTemplate) {
        activeTemplate.subjectTemplate = activeTemplate.subjectTemplate.replace(
          /\{\{companyname\}\}/gi,
          '{{company}}'
        );
      }
    }

    const payload: ApplicationCreateDto = {
      ...this.formModel,
      companyName: (this.formModel.companyName ?? '').trim(),
      jobTitle: (this.formModel.jobTitle ?? '').trim(),
      recipientEmail: (this.formModel.recipientEmail ?? '').trim(),
      templateId: Number(this.formModel.templateId),
      cvVariantId: this.formModel.cvVariantId
        ? Number(this.formModel.cvVariantId)
        : undefined,
    };

    this.pendingNoCvConfirmation = false;
    this.pendingAction = null;
    this.lastSubmittedAction = action;

    if (action === 'send') {
      this.formSubmitAndSend.emit(payload);
    } else {
      this.formSubmit.emit(payload);
    }
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  /**
   * Resolver exclusively for the subject template. Only handles company and position fields.
   */
  private applySubjectPlaceholders(template: string): string {
    const company = this.formModel.companyName || '';
    const position = this.formModel.jobTitle || '';

    return template
      .replace(/\{\{companyname\}\}/gi, company)
      .replace(/\{\{company\}\}/gi, company)
      .replace(/\{\{position\}\}/gi, position)
      .replace(/\{\{role\}\}/gi, position)
      .replace(/\{\{jobtitle\}\}/gi, position)
      .replace(/\{\{job_title\}\}/gi, position);
  }

  /**
   * Resolver exclusively for the body template. Handles company, position, skills, and notes.
   */
  private applyBodyPlaceholders(template: string): string {
    const company = this.formModel.companyName || '';
    const position = this.formModel.jobTitle || '';
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

    // If the template has no skills placeholder but the user has selected
    // skills, append the bullets before the closing line.
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
      .map((id) => this.getSkillSentence(id))
      .filter((sentence) => !!sentence)
      .map((sentence) => `• ${sentence}`)
      .join('\n');
  }
}
