import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { SidebarNavComponent } from '../sidebar-nav/sidebar-nav.component';
import { ThemeToggleComponent } from '../theme-toggle/theme-toggle.component';

@Component({
  selector: 'app-sidebar-desktop',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    SidebarNavComponent,
    ThemeToggleComponent,
  ],
  templateUrl: './sidebar-desktop.component.html',
})
export class SidebarDesktopComponent {
  @Input() collapsed = false;
  @Input() userName = 'New User';
  @Input() userProfilePic?: string;
  @Input() isDark = false;

  @Output() collapsedChange = new EventEmitter<boolean>();
  @Output() toggleTheme = new EventEmitter<void>();
  @Output() logout = new EventEmitter<void>();
  @Output() photoError = new EventEmitter<void>();
  @Output() requestDeleteAccount = new EventEmitter<void>();

  isGearOpen = false;

  toggleCollapse(): void {
    const next = !this.collapsed;
    this.collapsedChange.emit(next);
    if (next) this.isGearOpen = false;
  }

  toggleGearMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.isGearOpen = !this.isGearOpen;
    this.collapsedChange.emit(false);
  }

  onDeleteAccountClick(): void {
    this.isGearOpen = false;
    this.requestDeleteAccount.emit();
  }

  /** Closes the settings dropdown on any outside click. */
  @HostListener('document:click')
  onDocumentClick(): void {
    this.isGearOpen = false;
  }
}
