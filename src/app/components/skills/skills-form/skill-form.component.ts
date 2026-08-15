import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  OnDestroy,
  DoCheck,
  SimpleChanges,
} from '@angular/core';
import { trigger, style, transition, animate } from '@angular/animations';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Category } from '../../../models';
import { ToastService } from '../../common/toast/toast.service';

interface SkillFormData {
  name: string;
  sentenceEn: string;
  sentenceFr: string;
  categoryId: number | null;
}

interface SkillFormErrors {
  name?: string;
  sentenceEn?: string;
  sentenceFr?: string;
  categoryId?: string;
}

@Component({
  selector: 'app-skill-form',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './skill-form.component.html',
  animations: [
    trigger('formSlide', [
      transition(':enter', [
        style({ opacity: 0, height: '0px', overflow: 'hidden' }),
        animate(
          '280ms cubic-bezier(0.4, 0, 0.2, 1)',
          style({ opacity: 1, height: '*' })
        ),
      ]),
      transition(':leave', [
        style({ opacity: 1, height: '*', overflow: 'hidden' }),
        animate(
          '220ms cubic-bezier(0.4, 0, 0.2, 1)',
          style({ opacity: 0, height: '0px' })
        ),
      ]),
    ]),
  ],
})
export class SkillFormComponent implements OnChanges, OnDestroy, DoCheck {
  constructor(private toastService: ToastService) {}

  @Input() categories: Category[] = [];
  @Input() editingSkillId: number | null = null;
  @Input() isFormExpanded = false;
  @Input() initialData: SkillFormData = {
    name: '',
    sentenceEn: '',
    sentenceFr: '',
    categoryId: null,
  };
  @Input() loading = false;

  @Output() save = new EventEmitter<SkillFormData>();
  @Output() cancel = new EventEmitter<void>();

  isFormVisible = false;

  /** General banner shown above the form (e.g. server-side failure) */
  errorMessage = '';

  /** Per-field validation errors */
  fieldErrors: SkillFormErrors = {};

  /** Tracks which fields the user has interacted with, so we don't
   *  show errors before they've had a chance to type anything. */
  touched: Record<keyof SkillFormData, boolean> = {
    name: false,
    sentenceEn: false,
    sentenceFr: false,
    categoryId: false,
  };

  formData: SkillFormData = { ...this.initialData };

  private static readonly MAX_NAME_LENGTH = 80;
  private static readonly MAX_SENTENCE_LENGTH = 400;

  // ─── Draft persistence (localStorage) ──────────────────────────────────────

  /** localStorage key used to persist an unsaved draft across reloads/tab switches. */
  private readonly draftStorageKey = 'skillForm.draft';
  /** Drafts older than this are treated as stale and discarded rather than restored. */
  private readonly draftMaxAgeMs = 24 * 60 * 60 * 1000; // 24h

  /** Last-seen JSON snapshot of formData, used by ngDoCheck to detect edits cheaply. */
  private lastFormSnapshot = '';
  private persistDebounceHandle: ReturnType<typeof setTimeout> | null = null;

  /** Set when a draft was silently restored into formData — the toast fires the next time the form is actually opened, not immediately on load. */
  private draftPendingToast = false;

  ngOnChanges(changes: SimpleChanges): void {
    // Entering edit mode invalidates any draft-save that's still pending from
    // typing into a *new* skill — without this, the debounce timer would fire
    // after formData has already been overwritten with the edited skill's
    // data, and silently persist that as if it were the new-skill draft.
    if (changes['editingSkillId'] && this.editingSkillId !== null) {
      this.cancelPendingDraftPersist();

      // Opening the form for editing must always show it, even if it was
      // previously closed via Cancel. Relying solely on isFormExpanded
      // transitioning false->true breaks the second time you click Edit,
      // since isFormExpanded may stay bound to true across both clicks and
      // Angular won't re-fire ngOnChanges for a value that didn't change.
      this.isFormVisible = true;
    }

    if (changes['initialData']) {
      this.formData = { ...this.initialData };
      this.resetValidationState();

      // Only new-skill entries get a draft — editing an existing skill
      // should always reflect that skill's real saved data.
      if (this.editingSkillId === null) {
        this.restoreDraft();
      }
      this.lastFormSnapshot = JSON.stringify(this.formData);
    }

    if (
      changes['isFormExpanded'] &&
      this.isFormExpanded &&
      !this.isFormVisible
    ) {
      this.isFormVisible = true;
      if (this.editingSkillId === null) {
        this.notifyDraftRestoredIfPending();
      }
    }
  }

  ngDoCheck(): void {
    if (this.editingSkillId !== null) return; // don't persist drafts while editing an existing skill

    const snapshot = JSON.stringify(this.formData);
    if (snapshot !== this.lastFormSnapshot) {
      this.lastFormSnapshot = snapshot;
      this.scheduleDraftPersist(snapshot);
    }
  }

  ngOnDestroy(): void {
    this.cancelPendingDraftPersist();
  }

  private cancelPendingDraftPersist(): void {
    if (this.persistDebounceHandle) {
      clearTimeout(this.persistDebounceHandle);
      this.persistDebounceHandle = null;
    }
  }

  /**
   * Schedules a persist of the given snapshot (captured at call time, not
   * re-read from `this.formData` when the timer fires). This is what avoids
   * the edit-mode race: even if `formData` has since been overwritten by a
   * switch into editing, we still only ever write the snapshot that was
   * valid when the user was actually typing it.
   */
  private scheduleDraftPersist(snapshot: string): void {
    this.cancelPendingDraftPersist();
    this.persistDebounceHandle = setTimeout(() => {
      this.persistDebounceHandle = null;
      // Extra safety net: if edit mode was entered in between, don't persist.
      if (this.editingSkillId !== null) return;
      this.persistDraftSnapshot(snapshot);
    }, 600);
  }

  private persistDraftSnapshot(snapshot: string): void {
    try {
      const payload = { data: JSON.parse(snapshot), savedAt: Date.now() };
      localStorage.setItem(this.draftStorageKey, JSON.stringify(payload));
    } catch {
      // localStorage unavailable (private browsing, quota, etc.) — fail silently
    }
  }

  private restoreDraft(): void {
    try {
      const raw = localStorage.getItem(this.draftStorageKey);
      if (!raw) return;

      const { data, savedAt } = JSON.parse(raw) as {
        data: Partial<SkillFormData>;
        savedAt: number;
      };

      const isExpired =
        typeof savedAt !== 'number' ||
        Date.now() - savedAt > this.draftMaxAgeMs;
      if (isExpired) {
        this.clearDraft();
        return;
      }

      const formIsEmpty =
        !this.formData.name &&
        !this.formData.sentenceEn &&
        !this.formData.sentenceFr &&
        this.formData.categoryId === null;

      // Only restore into an empty form so we never clobber data set another way
      if (formIsEmpty) {
        this.formData = { ...this.formData, ...data };
        this.draftPendingToast = true;
      }
    } catch {
      // Corrupted draft — ignore and start fresh
      this.clearDraft();
    }
  }

  /** Shows the "draft restored" toast, but only the first time the form is actually opened after a silent restore. */
  private notifyDraftRestoredIfPending(): void {
    if (this.draftPendingToast) {
      this.draftPendingToast = false;
      this.toastService.info('Unsaved draft restored.');
    }
  }

  private clearDraft(): void {
    try {
      localStorage.removeItem(this.draftStorageKey);
    } catch {
      // ignore
    }
  }

  // ─────────────────────────────────────────────────────────────────────────

  onToggleForm(): void {
    const wasVisible = this.isFormVisible;
    this.isFormVisible = !this.isFormVisible;
    if (!wasVisible && this.isFormVisible && this.editingSkillId === null) {
      this.notifyDraftRestoredIfPending();
    }
  }

  /** Call on (blur) to mark a field as touched and validate it live. */
  onFieldBlur(field: keyof SkillFormData): void {
    this.touched[field] = true;
    this.validateField(field);
  }

  onSave(): void {
    this.errorMessage = '';

    // Mark everything as touched so all relevant errors surface at once.
    (Object.keys(this.touched) as Array<keyof SkillFormData>).forEach(
      (key) => (this.touched[key] = true)
    );

    const isValid = this.validateAll();
    if (!isValid) {
      this.errorMessage = 'Please fix the highlighted fields before saving.';
      return;
    }

    const payload: SkillFormData = {
      name: this.formData.name.trim(),
      sentenceEn: this.formData.sentenceEn.trim(),
      sentenceFr: this.formData.sentenceFr?.trim() ?? '',
      categoryId: this.formData.categoryId,
    };

    // Only clear the draft when this was a *new* skill — editing an existing
    // skill has no relationship to the pending new-skill draft, so saving an
    // edit must never wipe it out.
    if (this.editingSkillId === null) {
      this.clearDraft();
    }
    this.save.emit(payload);
    this.isFormVisible = false;
  }

  onCancel(): void {
    this.isFormVisible = false;
    this.resetValidationState();
    // Same guard as onSave: only discard the draft if we were actually
    // editing the new-skill form, not cancelling an edit of an existing one.
    if (this.editingSkillId === null) {
      this.clearDraft();
    }
    this.cancel.emit();
  }

  /** Convenience getter for the template to know if a field should show as invalid. */
  hasError(field: keyof SkillFormData): boolean {
    return this.touched[field] && !!this.fieldErrors[field];
  }

  /** Returns the border/focus-ring classes for a field, valid vs invalid state. */
  fieldClasses(field: keyof SkillFormData): string {
    return this.hasError(field)
      ? 'border-rose-400 dark:border-rose-500/50 focus:ring-rose-500/20 focus:border-rose-500'
      : 'border-slate-200 dark:border-slate-800 focus:ring-indigo-500/20 focus:border-indigo-500';
  }

  /** Color-codes a character counter as it approaches/exceeds the max length. */
  counterClasses(length: number | undefined): string {
    const len = length ?? 0;
    if (len > SkillFormComponent.MAX_SENTENCE_LENGTH) {
      return 'text-danger-textLight dark:text-danger-textDark font-semibold';
    }
    if (len >= SkillFormComponent.MAX_SENTENCE_LENGTH - 20) {
      return 'text-amber-600 dark:text-amber-400 font-semibold';
    }
    return 'text-slate-400';
  }

  private resetValidationState(): void {
    this.errorMessage = '';
    this.fieldErrors = {};
    this.touched = {
      name: false,
      sentenceEn: false,
      sentenceFr: false,
      categoryId: false,
    };
  }

  private validateAll(): boolean {
    const nameValid = this.validateField('name');
    const enValid = this.validateField('sentenceEn');
    const frValid = this.validateField('sentenceFr');
    const categoryValid = this.validateField('categoryId');
    return nameValid && enValid && frValid && categoryValid;
  }

  private validateField(field: keyof SkillFormData): boolean {
    switch (field) {
      case 'name': {
        const value = this.formData.name?.trim() ?? '';
        if (!value) {
          this.fieldErrors.name = 'Skill display name is required.';
        } else if (value.length > SkillFormComponent.MAX_NAME_LENGTH) {
          this.fieldErrors.name = `Name must be ${SkillFormComponent.MAX_NAME_LENGTH} characters or fewer.`;
        } else {
          delete this.fieldErrors.name;
        }
        return !this.fieldErrors.name;
      }

      case 'sentenceEn': {
        const value = this.formData.sentenceEn?.trim() ?? '';
        if (!value) {
          this.fieldErrors.sentenceEn =
            'An English sentence example is required.';
        } else if (value.length > SkillFormComponent.MAX_SENTENCE_LENGTH) {
          this.fieldErrors.sentenceEn = `Keep it under ${SkillFormComponent.MAX_SENTENCE_LENGTH} characters.`;
        } else {
          delete this.fieldErrors.sentenceEn;
        }
        return !this.fieldErrors.sentenceEn;
      }

      case 'sentenceFr': {
        const value = this.formData.sentenceFr?.trim() ?? '';
        if (!value) {
          this.fieldErrors.sentenceFr =
            'A French sentence example is required.';
        } else if (value.length > SkillFormComponent.MAX_SENTENCE_LENGTH) {
          this.fieldErrors.sentenceFr = `Keep it under ${SkillFormComponent.MAX_SENTENCE_LENGTH} characters.`;
        } else {
          delete this.fieldErrors.sentenceFr;
        }
        return !this.fieldErrors.sentenceFr;
      }

      case 'categoryId': {
        if (
          this.formData.categoryId === null ||
          this.formData.categoryId === undefined
        ) {
          this.fieldErrors.categoryId = 'Please select a category.';
        } else {
          delete this.fieldErrors.categoryId;
        }
        return !this.fieldErrors.categoryId;
      }

      default:
        return true;
    }
  }
}
