import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { trigger, style, transition, animate } from '@angular/animations';
import { Observable } from 'rxjs';
import { Toast, ToastService } from './toast.service';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './toast-container.component.html',
  animations: [
    trigger('toastAnimation', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(8px) scale(0.96)' }),
        animate(
          '220ms cubic-bezier(0.4, 0, 0.2, 1)',
          style({ opacity: 1, transform: 'translateY(0) scale(1)' })
        ),
      ]),
      transition(':leave', [
        animate(
          '180ms cubic-bezier(0.4, 0, 0.2, 1)',
          style({ opacity: 0, transform: 'translateY(8px) scale(0.96)' })
        ),
      ]),
    ]),
  ],
})
export class ToastContainerComponent implements OnInit, OnDestroy {
  toasts$: Observable<Toast[]> = this.toastService.toasts$;

  /**
   * Ticks once a second purely so Angular re-renders the countdown next to
   * an action toast (e.g. "Undo (5s)"). Zone.js picks up the setInterval
   * callback and triggers change detection on its own — this field is
   * never read, its only job is to exist as an interval callback.
   */
  private tickTimer?: ReturnType<typeof setInterval>;

  constructor(private toastService: ToastService) {}

  ngOnInit(): void {
    this.tickTimer = setInterval(() => {
      /* no-op: presence of this callback is enough to trigger CD each second */
    }, 1000);
  }

  ngOnDestroy(): void {
    if (this.tickTimer) clearInterval(this.tickTimer);
  }

  dismiss(id: number): void {
    this.toastService.dismiss(id);
  }

  /** Fires the toast's action, then dismisses it — an undo shouldn't linger on screen after it's actioned. */
  onAction(toast: Toast): void {
    toast.action?.onClick();
    this.dismiss(toast.id);
  }

  /** Whole seconds remaining before an actionable toast (e.g. an "Undo" send) auto-fires. Floors at 0. */
  secondsLeft(toast: Toast): number {
    if (!toast.duration) return 0;
    const elapsed = Date.now() - toast.createdAt;
    return Math.max(0, Math.ceil((toast.duration - elapsed) / 1000));
  }

  trackById(index: number, toast: Toast): number {
    return toast.id;
  }

  iconFor(type: Toast['type']): string {
    switch (type) {
      case 'success':
        return 'check_circle_outline';
      case 'error':
        return 'error_outline';
      default:
        return 'info_outline';
    }
  }
}
