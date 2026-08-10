import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-delete-popup',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './delete-popup.component.html',
  styleUrls: ['./delete-popup.component.css'],
})
export class DeletePopupComponent {
  @Input() isModalOpen = false;
  @Input() title = 'Confirm Deletion';
  @Input() message = 'Are you sure you want to delete this item?';
  @Input() confirmLabel = 'Delete';
  @Input() cancelLabel = 'Cancel';
  @Input() isLoading = false;

  @Output() confirm = new EventEmitter<void>();
  @Output() close = new EventEmitter<void>();

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.isModalOpen && !this.isLoading) {
      this.onCancel();
    }
  }

  onBackdropClick(event: MouseEvent): void {
    if (this.isLoading) return;
    if (event.target === event.currentTarget) {
      this.onCancel();
    }
  }

  onCancel(): void {
    this.close.emit();
  }

  onConfirm(): void {
    this.confirm.emit();
  }
}
