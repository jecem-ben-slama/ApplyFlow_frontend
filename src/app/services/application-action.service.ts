import { Injectable } from '@angular/core';
import { ApplicationsService } from '../services/applications.service';
import { EmailService } from '../services/email.service';
import { ApplicationResponseDto } from '../models';

interface PendingAction {
  timeoutId: ReturnType<typeof setTimeout>;
  execute: () => void;
}

@Injectable({
  providedIn: 'root',
})
export class ApplicationActionService {
  private pendingSends = new Map<number, PendingAction>();
  private pendingStatusChanges = new Map<number, PendingAction>();
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
    this.pendingStatusChanges.set(id, { timeoutId, execute });
    return timeoutId;
  }

  executeStatusChangeNow(id: number): void {
    const pending = this.pendingStatusChanges.get(id);
    if (pending) {
      clearTimeout(pending.timeoutId);
      pending.execute();
    }
  }

  cancelStatusChange(id: number): void {
    if (this.pendingStatusChanges.has(id)) {
      clearTimeout(this.pendingStatusChanges.get(id)!.timeoutId);
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
    this.pendingSends.set(app.id, { timeoutId, execute });
    return timeoutId;
  }

  executeEmailSendNow(appId: number): void {
    const pending = this.pendingSends.get(appId);
    if (pending) {
      clearTimeout(pending.timeoutId);
      pending.execute();
    }
  }

  cancelEmailSend(appId: number): void {
    if (this.pendingSends.has(appId)) {
      clearTimeout(this.pendingSends.get(appId)!.timeoutId);
      this.pendingSends.delete(appId);
    }
  }
}
