import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { NgForm } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { CvVariantDto } from '../../../models';

@Component({
  selector: 'app-cv-popup',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './cv-popup.component.html',
  styleUrls: ['./cv-popup.component.css'],
})
export class CvPopupComponent implements OnInit {
  @Input() isModalOpen = false;
  @Input() isEditing = false;

  @Input() formModel: Omit<CvVariantDto, 'id' | 'userId' | 'createdAt'> = {
    name: '',
    language: 'en',
    fileUrl: '',
  };

  @Input() isLoading = false;

  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<void>();

  errorMessage = '';
  showDriveHelp = false;

  // Matches drive.google.com/file/d/..., /open?id=..., /uc?id=..., and docs.google.com share links
  readonly driveUrlPattern = '^https:\\/\\/(drive|docs)\\.google\\.com\\/.+$';

  ngOnInit(): void {}

  onCancel(): void {
    this.showDriveHelp = false;
    this.close.emit();
  }

  // Close the popover shortly after blur so the click on it still registers
  onDriveHelpBlur(): void {
    setTimeout(() => (this.showDriveHelp = false), 150);
  }

  onSubmit(form: NgForm): void {
    this.errorMessage = '';

    if (form.invalid) {
      Object.values(form.controls).forEach((control) =>
        control.markAsTouched()
      );
      this.errorMessage =
        'Please correct the highlighted fields before saving.';
      return;
    }

    // Extra guard beyond the pattern validator, in case someone bypasses the DOM
    if (
      !/^https:\/\/(drive|docs)\.google\.com\/.+/.test(this.formModel.fileUrl)
    ) {
      this.errorMessage =
        'The destination URL must be a Google Drive share link.';
      return;
    }

    this.save.emit();
  }
}
