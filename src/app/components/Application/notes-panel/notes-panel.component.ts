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

  isEditing = false;
  editValue = '';
  savedFlash = false;

  ngOnChanges(): void {
    // Reset edit state if the parent swaps the app (e.g. panel closes and reopens)
    this.isEditing = false;
    this.editValue = '';
  }

  startEdit(): void {
    this.editValue = this.app.notes ?? '';
    this.isEditing = true;
  }

  cancelEdit(): void {
    this.isEditing = false;
    this.editValue = '';
  }

  save(): void {
    this.notesSaved.emit({ appId: this.app.id, notes: this.editValue });
    this.isEditing = false;
    this.editValue = '';
    this.savedFlash = true;
    setTimeout(() => (this.savedFlash = false), 2000);
  }
}
