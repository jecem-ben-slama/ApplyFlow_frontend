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

  /**
   * NEW: server-side error passed down from SkillsComponent (set inside
   * onSaveSkill()'s error branch, cleared on a fresh attempt/edit-open).
   * Kept as a separate field from the internal `errorMessage` below
   * (client-side validation banner) rather than reusing that name — an
   * @Input() can't cleanly share an identifier with a plain instance
   * property that's also reassigned internally. The template combines
   * both via `displayedErrorMessage`.
   */
  @Input() serverErrorMessage = '';

  @Output() save = new EventEmitter<SkillFormData>();
  @Output() cancel = new EventEmitter<void>();

  isFormVisible = false;

  /** Client-side validation banner (e.g. "please fix the highlighted fields"). */
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

  private readonly draftStorageKey = 'skillForm.draft';
  private readonly draftMaxAgeMs = 24 * 60 * 60 * 1000; // 24h

  private lastFormSnapshot = '';
  private persistDebounceHandle: ReturnType<typeof setTimeout> | null = null;

  private draftPendingToast = false;

  /**
   * What the template actually renders in the error banner: the
   * client-validation message takes priority if both happen to be set
   * (it means the user re-triggered a client failure after a prior
   * server failure), otherwise falls back to the server error.
   */
  get displayedErrorMessage(): string {
    return this.errorMessage || this.serverErrorMessage;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['editingSkillId'] && this.editingSkillId !== null) {
      this.cancelPendingDraftPersist();
      this.isFormVisible = true;
    }

    if (changes['initialData']) {
      this.formData = { ...this.initialData };
      this.resetValidationState();

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

    // NEW: SkillsComponent only flips isFormExpanded back to false inside
    // onSaveSkill()'s SUCCESS branches — never on error. So mirroring that
    // transition here is what actually closes the form on a confirmed
    // save, now that onSave() below no longer closes it optimistically
    // itself. Without this branch, nothing would ever close the form on
    // success (onCancel() is the only other path that sets
    // isFormVisible = false, and that's user-initiated).
    if (
      changes['isFormExpanded'] &&
      !this.isFormExpanded &&
      this.isFormVisible
    ) {
      this.isFormVisible = false;
    }
  }

  ngDoCheck(): void {
    if (this.editingSkillId !== null) return;

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

  private scheduleDraftPersist(snapshot: string): void {
    this.cancelPendingDraftPersist();
    this.persistDebounceHandle = setTimeout(() => {
      this.persistDebounceHandle = null;
      if (this.editingSkillId !== null) return;
      this.persistDraftSnapshot(snapshot);
    }, 600);
  }

  private persistDraftSnapshot(snapshot: string): void {
    try {
      const payload = { data: JSON.parse(snapshot), savedAt: Date.now() };
      localStorage.setItem(this.draftStorageKey, JSON.stringify(payload));
    } catch {
      // localStorage unavailable — fail silently
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

      if (formIsEmpty) {
        this.formData = { ...this.formData, ...data };
        this.draftPendingToast = true;
      }
    } catch {
      this.clearDraft();
    }
  }

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

  onFieldBlur(field: keyof SkillFormData): void {
    this.touched[field] = true;
    this.validateField(field);
  }

  onSave(): void {
    this.errorMessage = '';

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

    if (this.editingSkillId === null) {
      this.clearDraft();
    }
    this.save.emit(payload);
    // isFormVisible is deliberately NOT touched here. Closing only
    // happens once the parent confirms success by flipping
    // isFormExpanded to false — see the ngOnChanges branch above. On a
    // server rejection, isFormExpanded stays true, serverErrorMessage
    // gets set, and the form correctly stays open with the error visible.
  }

  onCancel(): void {
    this.isFormVisible = false;
    this.resetValidationState();
    if (this.editingSkillId === null) {
      this.clearDraft();
    }
    this.cancel.emit();
  }

  hasError(field: keyof SkillFormData): boolean {
    return this.touched[field] && !!this.fieldErrors[field];
  }

  fieldClasses(field: keyof SkillFormData): string {
    return this.hasError(field)
      ? 'border-rose-400 dark:border-rose-500/50 focus:ring-rose-500/20 focus:border-rose-500'
      : 'border-slate-200 dark:border-slate-800 focus:ring-indigo-500/20 focus:border-indigo-500';
  }

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
