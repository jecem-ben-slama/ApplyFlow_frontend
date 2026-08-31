import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { SidebarNavComponent } from '../sidebar-nav/sidebar-nav.component';
import { ThemeToggleComponent } from '../theme-toggle/theme-toggle.component';
import { LogoComponent } from '../../logo/logo.component';

@Component({
  selector: 'app-sidebar-desktop',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatIconModule,
    SidebarNavComponent,
    ThemeToggleComponent,
    LogoComponent,
  ],
  templateUrl: './sidebar-desktop.component.html',
})
export class SidebarDesktopComponent {
  @Input() collapsed = false;
  @Input() userName = 'New User';
  @Input() userProfilePic?: string;
  @Input() isDark = false;
  @Input() isGuest = false;

  @Output() toggleCollapse = new EventEmitter<boolean>();
  @Output() toggleTheme = new EventEmitter<void>();
  @Output() logout = new EventEmitter<void>();
  @Output() photoError = new EventEmitter<void>();
  @Output() signIn = new EventEmitter<void>();

  isProfileOpen = false;

  onToggleCollapseClick(): void {
    this.toggleCollapse.emit(!this.collapsed);
  }

  onGearClick(): void {
    // If the sidebar is collapsed, the inline panel has no room to show
    // labels, so expand it first — then open (or toggle) the panel.
    if (this.collapsed) {
      this.toggleCollapse.emit(false);
      this.isProfileOpen = true;
    } else {
      this.isProfileOpen = !this.isProfileOpen;
    }
  }

  closeProfileMenu(): void {
    this.isProfileOpen = false;
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    if (this.isProfileOpen) this.closeProfileMenu();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isProfileOpen) this.closeProfileMenu();
  }
}
