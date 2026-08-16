import { Injectable, signal } from '@angular/core';

/**
 * Tiny cross-route handoff: the application row sets the id it wants
 * selected right before navigating to the dashboard, and the dashboard
 * consumes (and clears) it once on init. Avoids needing query params.
 */
@Injectable({ providedIn: 'root' })
export class PendingSelectionService {
  private pendingAppId = signal<number | null>(null);

  setPendingAppId(id: number): void {
    this.pendingAppId.set(id);
  }

  /** Reads and clears the pending id in one go, so it's only ever consumed once. */
  consumePendingAppId(): number | null {
    const id = this.pendingAppId();
    this.pendingAppId.set(null);
    return id;
  }
}
