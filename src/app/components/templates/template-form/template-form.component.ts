import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-template-form',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './template-form.component.html',
})
export class TemplateFormComponent {
  @Input() isFormVisible = false;
  @Input() isEditing = false;
  @Input() loading = false;
  @Input() errorMessage = '';
  @Input() templateData: {
    name: string;
    language: string;
    subjectTemplate: string;
    bodyTemplate: string;
  } = {
    name: '',
    language: 'EN',
    subjectTemplate: '',
    bodyTemplate: '',
  };
  @Input() subjectPlaceholder = '';

  @Output() onToggle = new EventEmitter<void>();
  @Output() submit = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();
}
