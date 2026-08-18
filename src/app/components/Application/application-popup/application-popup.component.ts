import {
  Component,
  EventEmitter,
  Input,
  OnInit,
  OnDestroy,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Subject, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import {
  ApplicationCreateDto,
  Skill,
  CvVariantDto,
  TemplateDto,
  Category,
} from '../../../models';
import { ApplicationPresetDto } from 'src/app/models/application_preset.model';
import { ToastService } from '../../common/toast/toast.service';
// Adjust this import path to match where toast.service.ts actually lives relative to this component.

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
export class ApplicationPopupComponent implements OnInit, OnDestroy {
  constructor(
    private sanitizer: DomSanitizer,
    private toastService: ToastService
  ) {}
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
  @Output() draftSave = new EventEmitter<ApplicationCreateDto>();

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

  // ---------------------------------------------------------------------
  // Draft persistence (localStorage)
  // ---------------------------------------------------------------------

  /** localStorage key used to persist an unsaved draft across reloads/tab switches. */
  private readonly draftStorageKey = 'applicationPopup.draft';

  private draftTrigger = new Subject<void>();
  private draftSub?: Subscription;

  /**
   * True when a preset is driving this open of the popup. Mirrors
   * `isEditing` on the template form: a preset's values are not part of any
   * pending "new application" draft, so drafts are never restored into,
   * persisted from, or cleared by a preset-prefilled session.
   */
  private get isPresetDriven(): boolean {
    return !!this.prefillFromPreset;
  }

  ngOnInit(): void {
    // Unlike the template form, this component is created fresh every time
    // the modal opens (it lives behind *ngIf in the parent) and destroyed on
    // close — so ngOnInit *is* "the form just opened". No need to wait for a
    // separate visibility-change event before restoring or toasting.
    if (this.prefillFromPreset) {
      this.applyPreset(this.prefillFromPreset);
    } else {
      this.restoreDraft();
    }

    this.draftSub = this.draftTrigger.pipe(debounceTime(600)).subscribe(() => {
      if (!this.isPresetDriven) {
        this.persistDraft();
        this.draftSave.emit({ ...this.formModel });
      }
    });
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

      const draft: Partial<ApplicationCreateDto> = JSON.parse(raw);
      const formIsEmpty =
        !this.formModel.companyName &&
        !this.formModel.jobTitle &&
        !this.formModel.recipientEmail &&
        !this.formModel.templateId &&
        !this.formModel.notes &&
        !this.formModel.skillIds?.length;

      // Only restore into an empty form so we never clobber data the parent passed in
      if (formIsEmpty) {
        this.formModel = { ...this.formModel, ...draft };

        // Re-run the same side effects a manual selection would trigger, so
        // the template preview / language match / CV compatibility all stay
        // in sync with the restored values.
        if (this.formModel.templateId) {
          this.onTemplateChange();
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
    this.notifyDraft();
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
      this.notifyDraft();
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
    this.notifyDraft();
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
    this.notifyDraft();
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
    this.notifyDraft();
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
   * Rendered subject line text plain. Used for the actual payload/clipboard
   * copy, so unfilled fields resolve to '' here (never a visible pending
   * mark) — that styling only belongs in the *Html preview variants.
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
   * Rendered subject for the live preview panel: filled fields get a quiet
   * blue tint, and any placeholder that isn't filled in yet stays visible as
   * a muted, dashed-underline label instead of silently vanishing — so the
   * user can see at a glance what's left to fill in, without the preview
   * shouting about it.
   */
  getRenderedSubjectHtml(): SafeHtml {
    const company = this.formModel.companyName || '';
    const position = this.formModel.jobTitle || '';

    if (this.selectedTemplatePreview?.subjectTemplate) {
      const html = this.escapeHtml(this.selectedTemplatePreview.subjectTemplate)
        .replace(
          /\{\{companyname\}\}/gi,
          this.renderPreviewValue(company, 'Company Name')
        )
        .replace(
          /\{\{company\}\}/gi,
          this.renderPreviewValue(company, 'Company Name')
        )
        .replace(
          /\{\{position\}\}/gi,
          this.renderPreviewValue(position, 'Position')
        )
        .replace(
          /\{\{role\}\}/gi,
          this.renderPreviewValue(position, 'Position')
        )
        .replace(
          /\{\{jobtitle\}\}/gi,
          this.renderPreviewValue(position, 'Position')
        )
        .replace(
          /\{\{job_title\}\}/gi,
          this.renderPreviewValue(position, 'Position')
        );

      return this.sanitizer.bypassSecurityTrustHtml(html);
    }

    // No template subject to work from — compose the same fallback text as
    // getRenderedSubject(), just with the present values tinted. There's no
    // literal placeholder token here to keep visible, since the fallback
    // only ever includes the parts that are actually filled in.
    let html: string;
    if (position && company) {
      html = `Application for ${this.filledMark(position)} at ${this.filledMark(
        company
      )}`;
    } else if (position) {
      html = `Application for ${this.filledMark(position)}`;
    } else if (company) {
      html = `Application at ${this.filledMark(company)}`;
    } else {
      html = 'Job Application';
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
   * position, skills, notes) get a quiet inline tint so they stand out from
   * the static template text without shouting. Any placeholder that has
   * nothing to substitute yet — an empty company/position/notes, or no
   * skills selected — stays visible as a small muted label rather than being
   * replaced with nothing, so the user can see exactly what the template
   * still needs.
   */
  getRenderedEmailBodyHtml(): SafeHtml {
    if (!this.selectedTemplatePreview?.bodyTemplate) return '';

    const company = this.formModel.companyName || '';
    const position = this.formModel.jobTitle || '';
    const bullets = this.buildSkillBullets();

    const skillPattern =
      /\{\{(skills_block|skills|skillbullets|skill_bullets)\}\}/gi;
    const hasSkillPlaceholder = skillPattern.test(
      this.selectedTemplatePreview.bodyTemplate
    );

    // Build tinted bullets HTML (one per line), or a pending label if the
    // template expects skills but none are selected yet.
    const bulletsHtml = bullets
      ? bullets
          .split('\n')
          .map((line) => this.filledMark(line))
          .join('\n')
      : this.pendingMark('Skills');

    let html = this.escapeHtml(this.selectedTemplatePreview.bodyTemplate)
      // company
      .replace(
        /\{\{companyname\}\}/gi,
        this.renderPreviewValue(company, 'Company Name')
      )
      .replace(
        /\{\{company\}\}/gi,
        this.renderPreviewValue(company, 'Company Name')
      )
      // position
      .replace(
        /\{\{position\}\}/gi,
        this.renderPreviewValue(position, 'Position')
      )
      .replace(/\{\{role\}\}/gi, this.renderPreviewValue(position, 'Position'))
      .replace(
        /\{\{jobtitle\}\}/gi,
        this.renderPreviewValue(position, 'Position')
      )
      .replace(
        /\{\{job_title\}\}/gi,
        this.renderPreviewValue(position, 'Position')
      )
      // misc
      .replace(
        /\{\{language\}\}/gi,
        this.renderPreviewValue(this.formModel.language, 'Language')
      )
      .replace(
        /\{\{notes\}\}/gi,
        this.renderPreviewValue(this.formModel.notes, 'Notes')
      )
      // skills (all variants including skills_block)
      .replace(
        /\{\{(skills_block|skills|skillbullets|skill_bullets)\}\}/gi,
        bulletsHtml
      );

    // If no placeholder exists but skills are selected, inject before sign-off.
    // (Nothing to inject if the template has no placeholder AND no skills are
    // selected — there's no token in the raw text to keep visible in that case.)
    if (!hasSkillPlaceholder && bullets) {
      const highlightedBullets = bullets
        .split('\n')
        .map((line) => this.filledMark(line))
        .join('\n');
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
      lines.splice(insertAt, 0, '', highlightedBullets, '');
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

  /** Wraps the close output so the persisted draft is cleared on explicit dismissal — but only when this wasn't a preset-prefilled session. */
  closeModal(): void {
    if (!this.isPresetDriven) {
      this.clearDraft();
    }
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

    // Only clear the draft when this was a genuine new-application draft —
    // a preset-driven session was never persisted as one in the first place.
    if (!this.isPresetDriven) {
      this.clearDraft();
    }

    if (action === 'send') {
      this.formSubmitAndSend.emit(payload);
    } else {
      this.formSubmit.emit(payload);
    }
  }

  // ─── Preview highlighting ──────────────────────────────────────────────────

  private escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /**
   * Highlight for a value that IS present — a quiet inline tint, not a
   * loud badge. Plain text (no inline-flex/nowrap) so it wraps exactly like
   * the surrounding copy, whether it's one word or a full sentence.
   */
  private filledMark(value: string): string {
    return `<span style="background-color:rgba(59,130,246,0.14);color:#60a5fa;padding:0 3px;border-radius:3px;font-weight:500;box-decoration-break:clone;-webkit-box-decoration-break:clone">${this.escapeHtml(
      value
    )}</span>`;
  }

  /**
   * Counterpart for a placeholder with nothing to substitute yet. Styled as
   * a quiet small-caps tag — muted color, dashed underline, no fill — so it
   * reads as "still needed" rather than as an alert. Deliberately smaller
   * and lower-contrast than `filledMark`, since a pending field is
   * informational, not urgent.
   */
  private pendingMark(label: string): string {
    return `<span style="color:#94a3b8;font-weight:600;font-size:0.78em;letter-spacing:0.04em;text-transform:uppercase;border-bottom:1px dashed #64748b;padding-bottom:1px;white-space:nowrap">${this.escapeHtml(
      label
    )}</span>`;
  }

  /** Renders a placeholder's replacement HTML: filled mark if present, pending mark (with label) if empty. */
  private renderPreviewValue(value: string | undefined, label: string): string {
    const filled = (value ?? '').trim();
    return filled ? this.filledMark(filled) : this.pendingMark(label);
  }

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

  clearAllSkills(): void {
    this.formModel.skillIds = [];
    this.notifyDraft();
  }

  /** Count of currently selected skills that belong to a given category — drives the category button badges. */
  getSelectedCountForCategory(categoryId: number): number {
    const idsInCategory = new Set(
      this.availableSkills
        .filter((s) => s.categoryId === categoryId)
        .map((s) => s.id)
    );
    return this.formModel.skillIds.filter((id) => idsInCategory.has(id)).length;
  }
}
