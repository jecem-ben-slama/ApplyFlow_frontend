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

  readonly toasts$ = this.toastsSubject.asObservable();

  show(type: ToastType, message: string, durationMs = 4000): number {
    const id = this.nextId++;
    this.toastsSubject.next([...this.toastsSubject.value, { id, type, message }]);

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

  dismiss(id: number): void {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
    this.toastsSubject.next(this.toastsSubject.value.filter((t) => t.id !== id));
  }

  clearAll(): void {
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers.clear();
    this.toastsSubject.next([]);
  }
}
