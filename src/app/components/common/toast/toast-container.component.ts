import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { Observable } from 'rxjs';
import { Toast, ToastService } from './toast.service';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './toast-container.component.html',
})
export class ToastContainerComponent {
  toasts$: Observable<Toast[]> = this.toastService.toasts$;

  constructor(private toastService: ToastService) {}

  dismiss(id: number): void {
    this.toastService.dismiss(id);
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
