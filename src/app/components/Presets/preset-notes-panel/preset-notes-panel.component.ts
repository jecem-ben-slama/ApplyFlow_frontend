import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApplicationPresetDto } from 'src/app/models/application_preset.model';

@Component({
  selector: 'app-preset-notes-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './preset-notes-panel.component.html',
})
export class PresetNotesPanelComponent implements OnChanges {
  @Input() preset!: ApplicationPresetDto;
  @Output() notesSaved = new EventEmitter<{
    presetId: number;
    notes: string;
  }>();

  readonly maxLength = 1000;

  isEditing = false;
  editValue = '';
  savedFlash = false;
  showCancelConfirm = false;

  ngOnChanges(): void {
    this.isEditing = false;
    this.editValue = '';
    this.showCancelConfirm = false;
  }

  get hasUnsavedChanges(): boolean {
    return this.isEditing && this.editValue !== (this.preset.notes ?? '');
  }

  get charCount(): number {
    return this.editValue.length;
  }

  get isOverLimit(): boolean {
    return this.charCount > this.maxLength;
  }

  startEdit(): void {
    this.editValue = this.preset.notes ?? '';
    this.isEditing = true;
    this.showCancelConfirm = false;
  }

  cancelEdit(): void {
    if (this.hasUnsavedChanges) {
      this.showCancelConfirm = true;
      return;
    }
    this.confirmDiscard();
  }

  confirmDiscard(): void {
    this.showCancelConfirm = false;
    this.isEditing = false;
    this.editValue = '';
  }

  dismissDiscard(): void {
    this.showCancelConfirm = false;
  }

  save(): void {
    if (this.isOverLimit) return;
    this.notesSaved.emit({
      presetId: this.preset.id,
      notes: this.editValue.trim(),
    });
    this.isEditing = false;
    this.editValue = '';
    this.showCancelConfirm = false;
    this.savedFlash = true;
    setTimeout(() => (this.savedFlash = false), 2500);
  }

  onKeydown(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      this.save();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.cancelEdit();
    }
  }
}
