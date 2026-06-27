import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApplicationResponseDto } from '../../../models';
import { NotesPanelComponent } from '../notes-panel/notes-panel.component';

@Component({
  selector: 'app-email-panel',
  standalone: true,
  imports: [CommonModule, NotesPanelComponent],
  templateUrl: './email-panel.component.html',
})
export class EmailPanelComponent {
  @Input() app!: ApplicationResponseDto;
  @Input() isSending = false;

  @Output() sendEmail = new EventEmitter<ApplicationResponseDto>();
  @Output() copyBody = new EventEmitter<string>();
  @Output() notesSaved = new EventEmitter<{ appId: number; notes: string }>();
}
