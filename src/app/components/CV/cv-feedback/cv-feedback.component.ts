import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-cv-feedback',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './cv-feedback.component.html',
})
export class CvFeedbackComponent {
  @Input() error = '';
  @Input() success = '';

  @Output() dismissError = new EventEmitter<void>();
  @Output() dismissSuccess = new EventEmitter<void>();
}
