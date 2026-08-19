import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { ThemeToggleComponent } from '../theme-toggle/theme-toggle.component';

@Component({
  selector: 'app-mobile-more-sheet',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule, ThemeToggleComponent],
  templateUrl: './mobile-more-sheet.component.html',
})
export class MobileMoreSheetComponent {
  @Input() open = false;
  @Input() userName = 'New User';
  @Input() userProfilePic?: string;
  @Input() isDark = false;

  @Output() close = new EventEmitter<void>();
  @Output() toggleTheme = new EventEmitter<void>();
  @Output() photoError = new EventEmitter<void>();
  // requestDeleteAccount removed — deletion now only happens on the full
  // /profile page, which requires typing "delete {email}" to confirm.
}
