import { Component, Input, Output, EventEmitter, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApplicationResponseDto } from '../../../models';
import { NotesPanelComponent } from '../notes-panel/notes-panel.component';

@Component({
  selector: 'app-email-panel',
  standalone: true,
  imports: [CommonModule, NotesPanelComponent],
  templateUrl: './email-panel.component.html',
})
export class EmailPanelComponent implements OnChanges {
  @Input() app!: ApplicationResponseDto;
  @Input() isSending = false;
  /** Optional inline error surfaced by the parent for this specific panel's send attempt. */
  @Input() sendError = '';

  @Output() sendEmail = new EventEmitter<ApplicationResponseDto>();
  @Output() copyBody = new EventEmitter<string>();
  @Output() notesSaved = new EventEmitter<{ appId: number; notes: string }>();

  copied = false;
  /** True while we're waiting for a second click to confirm the send. */
  confirmingSend = false;
  private confirmTimeout?: ReturnType<typeof setTimeout>;

  ngOnChanges(): void {
    // Reset the send-confirmation affordance whenever a send resolves
    // (isSending flips back to false) or the underlying app changes.
    if (!this.isSending) {
      this.confirmingSend = false;
    }
  }

  onSendClick(): void {
    if (this.isSending) return;

    if (!this.confirmingSend) {
      this.confirmingSend = true;
      clearTimeout(this.confirmTimeout);
      this.confirmTimeout = setTimeout(() => (this.confirmingSend = false), 3000);
      return;
    }

    clearTimeout(this.confirmTimeout);
    this.confirmingSend = false;
    this.sendEmail.emit(this.app);
  }

  onCopyClick(): void {
    this.copyBody.emit(this.app.generatedBody);
    this.copied = true;
    setTimeout(() => (this.copied = false), 2000);
  }
}
