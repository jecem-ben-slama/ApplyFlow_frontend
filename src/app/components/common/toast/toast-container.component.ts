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

  private tickTimer?: ReturnType<typeof setInterval>;

  constructor(private toastService: ToastService) {}

  ngOnInit(): void {
    this.tickTimer = setInterval(() => {}, 1000);
  }

  ngOnDestroy(): void {
    if (this.tickTimer) clearInterval(this.tickTimer);
  }

  /**
   * Fires when pressing X: If an explicit onDismiss exists (e.g. immediate execution),
   * trigger it. Otherwise, simply dismiss the toast.
   */
  dismiss(toast: Toast): void {
    if (toast.action?.onDismiss) {
      toast.action.onDismiss();
    }
    this.toastService.dismiss(toast.id);
  }

  /**
   * Fires when pressing "Undo": Triggers onClick() (cancelling the request).
   */
  onAction(toast: Toast): void {
    if (toast.action?.onClick) {
      toast.action.onClick();
    }
    this.toastService.dismiss(toast.id);
  }

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