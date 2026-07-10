import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { trigger, style, transition, animate } from '@angular/animations';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Category } from '../../../models';

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
export class SkillFormComponent implements OnChanges {
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

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialData']) {
      this.formData = { ...this.initialData };
      this.resetValidationState();
    }
    if (changes['isFormExpanded'] && this.isFormExpanded) {
      this.isFormVisible = true;
    }
  }

  onToggleForm(): void {
    this.isFormVisible = !this.isFormVisible;
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

    this.save.emit(payload);
  }

  onCancel(): void {
    this.isFormVisible = false;
    this.resetValidationState();
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
