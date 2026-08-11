import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 0;
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();
  private readonly toastsSubject = new BehaviorSubject<Toast[]>([]);
  private readonly maxToasts = 4;

  readonly toasts$ = this.toastsSubject.asObservable();

  show(type: ToastType, message: string, durationMs = 4000): number {
    const id = this.nextId++;
    let next = [...this.toastsSubject.value, { id, type, message }];

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

  success(message: string, durationMs = 4000): number {
    return this.show('success', message, durationMs);
  }

  error(message: string, durationMs = 6000): number {
    return this.show('error', message, durationMs);
  }

  info(message: string, durationMs = 4000): number {
    return this.show('info', message, durationMs);
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
