import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
} from '@angular/core';
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
export class CvPopupComponent implements OnInit, OnChanges {
  @Input() isModalOpen = false;
  @Input() isEditing = false;

  @Input() formModel: Omit<CvVariantDto, 'id' | 'userId' | 'createdAt'> = {
    name: '',
    language: 'en',
    fileUrl: '',
  };

  @Input() isLoading = false;

  // Backend rejection message for the most recent save attempt (e.g. "This
  // file is too large to attach...", "This Google Drive file isn't
  // accessible..."). Owned by the parent: it should set this in the catch
  // block after a failed save call, and clear it (null) before the next
  // save attempt. Takes priority over the local client-side validation
  // message below, since it reflects the most recent real outcome.
  @Input() serverError: string | null = null;

  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<void>();

  // Client-side validation message — set locally when the form fails
  // validation before it's ever sent to the parent/backend.
  errorMessage = '';
  showDriveHelp = false;

  // Matches drive.google.com/file/d/..., /open?id=..., /uc?id=..., and docs.google.com share links
  readonly driveUrlPattern = '^https:\\/\\/(drive|docs)\\.google\\.com\\/.+$';

  ngOnInit(): void {}

  ngOnChanges(changes: SimpleChanges): void {
    // Reset the local client-side message each time the modal is (re)opened,
    // so a leftover validation error from a previous open/edit doesn't
    // flash before the person has touched anything this time around.
    // serverError is intentionally left alone here — it's parent-owned and
    // should reflect that specific save attempt's outcome until the parent
    // clears it.
    if (
      changes['isModalOpen'] &&
      changes['isModalOpen'].currentValue === true &&
      !changes['isModalOpen'].previousValue
    ) {
      this.errorMessage = '';
    }
  }

  // What the template actually renders. Server error wins when present,
  // since it reflects the outcome of the most recent real save attempt;
  // otherwise fall back to the local pre-submit validation message.
  get displayError(): string {
    return this.serverError || this.errorMessage;
  }

  // Esc closes the modal, but never while a save is in flight — don't let the
  // person lose an in-progress submission by accident.
  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.isModalOpen && !this.isLoading) {
      this.onCancel();
    }
  }

  // Clicking the dimmed backdrop closes the modal; clicking anything inside
  // the card itself won't bubble a matching target/currentTarget pair here.
  onBackdropClick(event: MouseEvent): void {
    if (this.isLoading) return;
    if (event.target === event.currentTarget) {
      this.onCancel();
    }
  }

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
      this.errorMessage = 'The URL must be a Google Drive share link.';
      return;
    }

    this.save.emit();
  }
}
