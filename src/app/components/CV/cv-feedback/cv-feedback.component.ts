import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-cv-feedback',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cv-feedback.component.html',
})
export class CvFeedbackComponent {
  @Input() error = '';
  @Input() success = '';
}
