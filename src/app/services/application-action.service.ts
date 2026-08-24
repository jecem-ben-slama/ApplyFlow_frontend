import { Injectable } from '@angular/core';
import { ApplicationsService } from '../services/applications.service';
import { EmailService } from '../services/email.service';
import { ApplicationResponseDto } from '../models';

interface QueuedStatusAction {
  timer: ReturnType<typeof setTimeout>;
  execute: () => void;
}

interface QueuedEmailAction {
  timer: ReturnType<typeof setTimeout>;
  execute: () => void;
}

@Injectable({
  providedIn: 'root',
})
export class ApplicationActionService {
  private pendingSends = new Map<number, QueuedEmailAction>();
  private pendingStatusChanges = new Map<number, QueuedStatusAction>();
  readonly UNDO_WINDOW_MS = 5000;

  constructor(
    private appService: ApplicationsService,
    private emailService: EmailService
  ) {}

  queueStatusChange(
    id: number,
    status: string,
    onSuccess: () => void,
    onError: (err: any) => void
  ): ReturnType<typeof setTimeout> {
    this.cancelStatusChange(id);

    const execute = () => {
      this.pendingStatusChanges.delete(id);
      this.appService
        .patchApplicationStatusOrNotes(id, status, undefined)
        .subscribe({
          next: () => onSuccess(),
          error: (err) => onError(err),
        });
    };

    const timeoutId = setTimeout(execute, this.UNDO_WINDOW_MS);
    this.pendingStatusChanges.set(id, { timer: timeoutId, execute });
    return timeoutId;
  }

  executeStatusChangeNow(id: number): void {
    const item = this.pendingStatusChanges.get(id);
    if (item) {
      clearTimeout(item.timer);
      item.execute();
    }
  }

  cancelStatusChange(id: number): void {
    const item = this.pendingStatusChanges.get(id);
    if (item) {
      clearTimeout(item.timer);
      this.pendingStatusChanges.delete(id);
    }
  }

  queueEmailSend(
    app: ApplicationResponseDto,
    wasCompiled: boolean,
    isCompileFlow: boolean,
    onSuccess: (msg?: string) => void,
    onError: (err: any) => void
  ): ReturnType<typeof setTimeout> {
    this.cancelEmailSend(app.id);

    const execute = () => {
      this.pendingSends.delete(app.id);
      this.emailService
        .sendEmail({
          recipientEmail: app.recipientEmail!,
          subject: app.generatedSubject,
          body: app.generatedBody,
          cvVariantId: app.cvVariantId ? Number(app.cvVariantId) : undefined,
          applicationId: app.id,
        })
        .subscribe({
          next: (msg) => onSuccess(msg),
          error: (err) => onError(err),
        });
    };

    const timeoutId = setTimeout(execute, this.UNDO_WINDOW_MS);
    this.pendingSends.set(app.id, { timer: timeoutId, execute });
    return timeoutId;
  }

  executeEmailSendNow(appId: number): void {
    const item = this.pendingSends.get(appId);
    if (item) {
      clearTimeout(item.timer);
      item.execute();
    }
  }

  cancelEmailSend(appId: number): void {
    const item = this.pendingSends.get(appId);
    if (item) {
      clearTimeout(item.timer);
      this.pendingSends.delete(appId);
    }
  }
}
