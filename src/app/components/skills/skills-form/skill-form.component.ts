import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import {
  trigger,
  style,
  transition,
  animate,
} from '@angular/animations';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Category } from '../../../models';

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
  @Input() initialData: {
    name: string;
    sentenceEn: string;
    sentenceFr: string;
    categoryId: number | null;
  } = {
    name: '',
    sentenceEn: '',
    sentenceFr: '',
    categoryId: null,
  };
  @Input() loading = false;

  @Output() save = new EventEmitter<any>();
  @Output() cancel = new EventEmitter<void>();

  isFormVisible = false;
  errorMessage = '';

  formData = { ...this.initialData };

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialData']) {
      this.formData = { ...this.initialData };
    }
    if (changes['isFormExpanded'] && this.isFormExpanded) {
      this.isFormVisible = true;
    }
  }

  onToggleForm(): void {
    this.isFormVisible = !this.isFormVisible;
  }

  onSave(): void {
    this.errorMessage = '';
    if (!this.formData.name?.trim()) {
      this.errorMessage = 'Skill display name is required.';
      return;
    }
    if (!this.formData.sentenceEn?.trim()) {
      this.errorMessage = 'English sentence example is required.';
      return;
    }
    this.save.emit(this.formData);
  }

  onCancel(): void {
    this.isFormVisible = false;
    this.cancel.emit();
  }
}
