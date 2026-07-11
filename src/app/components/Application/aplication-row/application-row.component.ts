import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApplicationResponseDto } from '../../../models';

@Component({
  selector: '[app-application-row]',
  standalone: true,
  imports: [CommonModule, FormsModule, ],
  templateUrl: './application-row.component.html',
})
export class ApplicationRowComponent {
  @Input() app!: ApplicationResponseDto;
  @Input() isExpanded = false;
  @Input() isSendingEmail = false;

  @Output() togglePanel = new EventEmitter<number>();
  @Output() statusChange = new EventEmitter<{ id: number; status: string }>();
  @Output() deleteApp = new EventEmitter<number>();
  @Output() sendEmail = new EventEmitter<ApplicationResponseDto>();
  @Output() copyBody = new EventEmitter<string>();
  @Output() notesSaved = new EventEmitter<{ appId: number; notes: string }>();
}
