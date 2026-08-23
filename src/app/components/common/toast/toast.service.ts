import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface Toast {
  id: number;
  type: ToastType;
  message: string;
  duration?: number;
  action?: ToastAction;
  /** Timestamp (ms) the toast was created — used to compute the live countdown next to an action. */
  createdAt: number;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 0;
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();
  private readonly toastsSubject = new BehaviorSubject<Toast[]>([]);
  private readonly maxToasts = 4;

  readonly toasts$ = this.toastsSubject.asObservable();

  show(
    type: ToastType,
    message: string,
    durationMs = 4000,
    action?: ToastAction
  ): number {
    const id = this.nextId++;
    const toast: Toast = {
      id,
      type,
      message,
      duration: durationMs > 0 ? durationMs : undefined,
      action,
      createdAt: Date.now(),
    };
    let next = [...this.toastsSubject.value, toast];

    // Cap the stack — drop the oldest overflow toasts (and their timers)
    if (next.length > this.maxToasts) {
      const overflow = next.slice(0, next.length - this.maxToasts);
      overflow.forEach((t) => this.clearTimer(t.id));
      next = next.slice(next.length - this.maxToasts);
    }

    this.toastsSubject.next(next);

    if (durationMs > 0) {
      const timer = setTimeout(() => this.dismiss(id), durationMs);
      this.timers.set(id, timer);
    }

    return id;
  }

  success(message: string, durationMs = 4000, action?: ToastAction): number {
    return this.show('success', message, durationMs, action);
  }

  error(message: string, durationMs = 6000, action?: ToastAction): number {
    return this.show('error', message, durationMs, action);
  }

  info(message: string, durationMs = 4000, action?: ToastAction): number {
    return this.show('info', message, durationMs, action);
  }

  dismiss(id: number): void {
    this.clearTimer(id);
    this.toastsSubject.next(
      this.toastsSubject.value.filter((t) => t.id !== id)
    );
  }

  clearAll(): void {
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers.clear();
    this.toastsSubject.next([]);
  }

  private clearTimer(id: number): void {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
  }
}
