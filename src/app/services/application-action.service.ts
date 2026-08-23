import { Injectable } from '@angular/core';
import { ApplicationsService } from '../services/applications.service';
import { EmailService } from '../services/email.service';
import { ApplicationResponseDto } from '../models';

@Injectable({
  providedIn: 'root',
})
export class ApplicationActionService {
  private pendingSends = new Map<number, ReturnType<typeof setTimeout>>();
  private pendingStatusChanges = new Map<
    number,
    ReturnType<typeof setTimeout>
  >();
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
    if (this.pendingStatusChanges.has(id)) {
      clearTimeout(this.pendingStatusChanges.get(id)!);
    }

    const timeoutId = setTimeout(() => {
      this.pendingStatusChanges.delete(id);
      this.appService
        .patchApplicationStatusOrNotes(id, status, undefined)
        .subscribe({
          next: () => onSuccess(),
          error: (err) => onError(err),
        });
    }, this.UNDO_WINDOW_MS);

    this.pendingStatusChanges.set(id, timeoutId);
    return timeoutId;
  }

  cancelStatusChange(id: number): void {
    if (this.pendingStatusChanges.has(id)) {
      clearTimeout(this.pendingStatusChanges.get(id)!);
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
    if (this.pendingSends.has(app.id)) {
      clearTimeout(this.pendingSends.get(app.id)!);
    }

    const timeoutId = setTimeout(() => {
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
    }, this.UNDO_WINDOW_MS);

    this.pendingSends.set(app.id, timeoutId);
    return timeoutId;
  }

  cancelEmailSend(appId: number): void {
    if (this.pendingSends.has(appId)) {
      clearTimeout(this.pendingSends.get(appId)!);
      this.pendingSends.delete(appId);
    }
  }
}
