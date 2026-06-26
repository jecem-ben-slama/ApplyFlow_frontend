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

  // Initial form model bound to parent or service mutation
  @Input() formModel: Omit<CvVariantDto, 'id' | 'userId' | 'createdAt'> = {
    name: '',
    language: 'en',
    fileUrl: '',
  };

  @Input() isLoading = false;

  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<void>();
  errorMessage = '';

  ngOnInit(): void {}

  onCancel(): void {
    this.close.emit();
  }

  onSubmit(form?: NgForm): void {
    this.errorMessage = '';
    if (form && !form.form.valid) {
      this.errorMessage =
        'Please correct the highlighted fields before saving.';
      return;
    }
    this.save.emit();
  }
}
