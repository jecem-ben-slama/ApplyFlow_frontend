import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { ThemeToggleComponent } from '../theme-toggle/theme-toggle.component';

@Component({
  selector: 'app-mobile-more-sheet',
  standalone: true,
  imports: [CommonModule, MatIconModule, ThemeToggleComponent],
  templateUrl: './mobile-more-sheet.component.html',
})
export class MobileMoreSheetComponent {
  @Input() open = false;
  @Input() userName = 'New User';
  @Input() userProfilePic?: string;
  @Input() isDark = false;

  @Output() close = new EventEmitter<void>();
  @Output() toggleTheme = new EventEmitter<void>();
  @Output() logout = new EventEmitter<void>();
  @Output() photoError = new EventEmitter<void>();
  @Output() requestDeleteAccount = new EventEmitter<void>();
}
