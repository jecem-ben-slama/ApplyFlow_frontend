import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeService } from '../../services/theme.service';
import { AuthService } from '../../services/auth.service';
import { SidebarDesktopComponent } from './sidebar-desktop/sidebar-desktop.component';
import { MobileSidebarComponent } from './mobile-sidebar/mobile-sidebar.component';
import { LogoutConfirmDialogComponent } from './logout/logout-confirm-dialog.component';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    SidebarDesktopComponent,
    MobileSidebarComponent,
    LogoutConfirmDialogComponent,
  ],
  templateUrl: './sidebar.component.html',
})
export class SidebarComponent implements OnInit {
  private readonly themeService = inject(ThemeService);
  private readonly authService = inject(AuthService);

  userName = 'New User';
  userEmail = '';
  userProfilePic?: string;
  isCollapsed = false;
  isConfirmLogoutOpen = false;
  isGuest = false;

  isDarkMode$ = this.themeService.isDarkMode$;

  // Account deletion now lives entirely on the /profile page (ProfileComponent),
  // which requires typing "delete {email}" and re-validates it server-side.

  // Cross-tab sync (logout, delete-account) is handled entirely inside
  // AuthService via its own localStorage broadcast — no BroadcastChannel
  // needed here anymore.

  ngOnInit(): void {
    this.authService.currentUser$.subscribe((user) => {
      if (user) {
        this.userName = user.name || (user.isGuest ? 'Guest' : 'User');
        this.userEmail = user.email || '';
        this.userProfilePic = user.pictureUrl || undefined;
        this.isGuest = user.isGuest;
      } else {
        this.userName = 'New User';
        this.userEmail = '';
        this.userProfilePic = undefined;
        this.isGuest = false;
      }
    });
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  onPhotoError(): void {
    this.userProfilePic = undefined;
  }

  requestLogout(): void {
    this.isConfirmLogoutOpen = true;
  }

  cancelLogout(): void {
    this.isConfirmLogoutOpen = false;
  }

  /** Called when the user confirms sign-out. AuthService.logout() already
   * broadcasts to other open tabs via its own localStorage mechanism. */
  confirmLogout(): void {
    this.isConfirmLogoutOpen = false;
    this.authService.logout();
  }

  /** Guest → real account. Full top-level redirect, same as the login page. */
  onSignIn(): void {
    this.authService.loginWithGoogle();
  }
}
