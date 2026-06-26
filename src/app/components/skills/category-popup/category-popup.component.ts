import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-category-popup',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './category-popup.component.html',
  styleUrls: ['./category-popup.component.css'],
})
export class CategoryPopupComponent {
  // Use a setter so internalName is synced the moment the modal opens
  private _isModalOpen = false;
  @Input() set isModalOpen(value: boolean) {
    this._isModalOpen = value;
    if (value) {
      // Modal just opened — copy the latest categoryName into the form field
      this.internalName = this._categoryName;
      this.internalError = '';
    }
  }
  get isModalOpen(): boolean {
    return this._isModalOpen;
  }

  private _categoryName = '';
  @Input() set categoryName(value: string) {
    this._categoryName = value ?? '';
    // Also sync if the modal is already open (e.g. edit click while open)
    if (this._isModalOpen) {
      this.internalName = this._categoryName;
    }
  }

  @Input() isEditing = false;
  @Input() isLoading = false;
  @Input() set errorMessage(value: string) {
    this.internalError = value ?? '';
  }

  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<string>();

  /** These are what the template binds to — never the @Input properties directly */
  internalName = '';
  internalError = '';

  onCancel(): void {
    this.close.emit();
  }

  onSubmit(form?: NgForm): void {
    if (form && form.invalid) return;

    const trimmed = this.internalName?.trim();
    if (!trimmed) {
      this.internalError = 'Category name is required.';
      return;
    }

    this.save.emit(trimmed);
  }
}
