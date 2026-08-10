import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApplicationResponseDto } from '../../../models';

@Component({
  selector: 'app-notes-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './notes-panel.component.html',
})
export class NotesPanelComponent implements OnChanges {
  @Input() app!: ApplicationResponseDto;
  @Output() notesSaved = new EventEmitter<{ appId: number; notes: string }>();

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
    return this.isEditing && this.editValue !== (this.app.notes ?? '');
  }

  get charCount(): number {
    return this.editValue.length;
  }

  get isOverLimit(): boolean {
    return this.charCount > this.maxLength;
  }

  startEdit(): void {
    this.editValue = this.app.notes ?? '';
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
    this.notesSaved.emit({ appId: this.app.id, notes: this.editValue.trim() });
    this.isEditing = false;
    this.editValue = '';
    this.showCancelConfirm = false;
    this.savedFlash = true;
    setTimeout(() => (this.savedFlash = false), 2500);
  }

  /** Ctrl/Cmd+Enter to save, Escape to cancel — standard textarea shortcuts. */
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
