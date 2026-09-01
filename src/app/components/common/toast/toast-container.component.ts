import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { trigger, style, transition, animate } from '@angular/animations';
import { Observable } from 'rxjs';
import { Toast, ToastService } from './toast.service';

interface SwipedToastState {
  startX: number;
  currentX: number;
  isDragging: boolean;
}

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

  swipeStates = new Map<number, SwipedToastState>();

  constructor(private toastService: ToastService) {}

  ngOnInit(): void {
    this.tickTimer = setInterval(() => {}, 1000);
  }

  ngOnDestroy(): void {
    if (this.tickTimer) clearInterval(this.tickTimer);
  }

  dismiss(toast: Toast): void {
    if (toast.action?.onDismiss) {
      toast.action.onDismiss();
    }
    this.toastService.dismiss(toast.id);
  }

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

  onPointerDown(event: PointerEvent, toast: Toast): void {
    const target = event.currentTarget as HTMLElement;
    target.setPointerCapture(event.pointerId);

    this.swipeStates.set(toast.id, {
      startX: event.clientX,
      currentX: 0,
      isDragging: true,
    });
  }

  onPointerMove(event: PointerEvent, toast: Toast): void {
    const state = this.swipeStates.get(toast.id);
    if (!state || !state.isDragging) return;

    state.currentX = event.clientX - state.startX;
  }

  onPointerUp(event: PointerEvent, toast: Toast): void {
    const state = this.swipeStates.get(toast.id);
    if (!state || !state.isDragging) return;

    state.isDragging = false;
    const threshold = 100;

    if (Math.abs(state.currentX) > threshold) {
      this.dismiss(toast);
    } else {
      state.currentX = 0;
    }

    this.swipeStates.set(toast.id, { ...state });
  }

  getTransform(toastId: number): string {
    const state = this.swipeStates.get(toastId);
    if (!state) return 'translateX(0px)';
    return `translateX(${state.currentX}px)`;
  }

  getOpacity(toastId: number): number {
    const state = this.swipeStates.get(toastId);
    if (!state) return 1;
    const distance = Math.abs(state.currentX);
    return Math.max(0.3, 1 - distance / 250);
  }
}
