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

  @Output() close = new EventEmitter<void>();
  @Output() formSubmit = new EventEmitter<ApplicationCreateDto>();

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

  /** Tracks which fields the user has interacted with, so errors only show after blur/change. */
  private touched: Partial<Record<ValidatedField, boolean>> = {};
  /** Set true once the user attempts a submit — forces all field errors to show. */
  private submitAttempted = false;

  ngOnInit(): void {}

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
  }

  /**
   * Preview shown inside the template card — substitutes form values into the
   * raw bodyTemplate so the user sees exactly how placeholders resolve.
   */
  getLiveTemplateBodyPreview(): string {
    if (!this.selectedTemplatePreview?.bodyTemplate) return '';
    return this.applyPlaceholders(this.selectedTemplatePreview.bodyTemplate);
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
      return this.applyPlaceholders(
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
    return this.applyPlaceholders(this.selectedTemplatePreview.bodyTemplate);
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

  onSubmit(): void {
    if (this.isLoading) return;
    this.errorMessage = '';
    this.submitAttempted = true;

    const fields: ValidatedField[] = [
      'templateId',
      'companyName',
      'jobTitle',
      'recipientEmail',
      'language',
    ];
    const firstError = fields
      .map((field) => this.getFieldError(field))
      .find((error) => !!error);

    if (firstError) {
      this.setError('Please fix the highlighted fields before compiling.');
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

    this.formSubmit.emit(payload);
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  /**
   * Central placeholder resolver.
   * Handles all known tag variants case-insensitively.
   * If the template contains a skills placeholder, it is replaced with a
   * bullet list of selected skill names. If not, bullets are appended before
   * any trailing sign-off line (heuristic: last non-empty line starting with
   * a common closing word).
   */
  private applyPlaceholders(template: string): string {
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
      .map((id) => `• ${this.getSkillName(id)}`)
      .join('\n');
  }
}
