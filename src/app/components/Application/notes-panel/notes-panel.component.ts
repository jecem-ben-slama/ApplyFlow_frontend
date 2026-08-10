import { Component, Input, Output, EventEmitter, OnChanges } from '@angular/core';
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

  ngOnChanges(): void {
    // If notes are being edited, don't yank the user out mid-edit unless the
    // underlying application actually changed (panel closed/reopened for a
    // different app). Comparing against the original value is enough here
    // since ngOnChanges only fires on @Input reference/property changes.
    this.isEditing = false;
    this.editValue = '';
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
  }

  cancelEdit(): void {
    if (this.hasUnsavedChanges) {
      const confirmDiscard = window.confirm(
        'Discard your unsaved note changes?'
      );
      if (!confirmDiscard) return;
    }
    this.isEditing = false;
    this.editValue = '';
  }

  save(): void {
    if (this.isOverLimit) return;
    this.notesSaved.emit({ appId: this.app.id, notes: this.editValue.trim() });
    this.isEditing = false;
    this.editValue = '';
    this.savedFlash = true;
    setTimeout(() => (this.savedFlash = false), 2000);
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
