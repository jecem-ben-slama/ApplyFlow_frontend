import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ThemeService } from '../../services/theme.service';
import { AuthService } from '../../services/auth.service';
import { SidebarDesktopComponent } from './sidebar-desktop/sidebar-desktop.component';
import { MobileSidebarComponent } from './mobile-sidebar/mobile-sidebar.component';
import { LogoutConfirmDialogComponent } from './logout/logout-confirm-dialog.component';
import { DeletePopupComponent } from '../common/delete-popup/delete-popup.component';

/** BroadcastChannel event key used to sync logout across tabs. */
const LOGOUT_CHANNEL = 'applyflow_auth';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    SidebarDesktopComponent,
    MobileSidebarComponent,
    LogoutConfirmDialogComponent,
    DeletePopupComponent,
  ],
  templateUrl: './sidebar.component.html',
})
export class SidebarComponent implements OnInit, OnDestroy {
  private readonly themeService = inject(ThemeService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  userName = 'New User';
  userProfilePic?: string;
  isCollapsed = false;
  isConfirmLogoutOpen = false;

  isDarkMode$ = this.themeService.isDarkMode$;

  // ─── Delete account state ───
  isConfirmDeleteOpen = false;
  isDeletingAccount = false;
  deleteAccountMessage =
    'This will schedule your account and all associated data — applications, templates, CVs, and presets — for permanent deletion in 7 days. You can cancel by logging back in before then.';

  /**
   * BroadcastChannel lets tabs on the same origin communicate without
   * a server round-trip. When one tab logs out it posts a message here,
   * and every other open tab receives it and redirects to /login.
   */
  private logoutChannel = new BroadcastChannel(LOGOUT_CHANNEL);

  ngOnInit(): void {
    this.authService.currentUser$.subscribe((user) => {
      if (user) {
        this.userName = user.name || 'User';
        this.userProfilePic = user.pictureUrl || undefined;
      } else {
        this.userName = 'New User';
        this.userProfilePic = undefined;
      }
    });

    this.logoutChannel.onmessage = (event) => {
      if (event.data === 'logout') {
        this.authService.handleCrossTabLogout();
      }
    };
  }

  ngOnDestroy(): void {
    this.logoutChannel.close();
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

  /**
   * Called when the user confirms sign-out.
   * Broadcasts the logout event to all other open tabs, then logs out this tab.
   */
  confirmLogout(): void {
    this.isConfirmLogoutOpen = false;
    this.logoutChannel.postMessage('logout');
    this.authService.logout();
  }

  // ─── Delete account ───

  requestDeleteAccount(): void {
    this.deleteAccountMessage =
      'This will schedule your account and all associated data — applications, templates, CVs, and presets — for permanent deletion in 7 days. You can cancel by logging back in before then.';
    this.isConfirmDeleteOpen = true;
  }

  cancelDeleteAccount(): void {
    if (this.isDeletingAccount) return;
    this.isConfirmDeleteOpen = false;
  }

  confirmDeleteAccount(): void {
    this.isDeletingAccount = true;
    this.authService.deleteAccount().subscribe({
      next: () => {
        this.isDeletingAccount = false;
        this.isConfirmDeleteOpen = false;
        this.logoutChannel.postMessage('logout'); // sync other tabs, same as confirmLogout
        this.router
          .navigate(['/login'], {
            queryParams: { accountDeletion: 'scheduled' },
          })
          .then(() => window.location.reload());
      },
      error: (err) => {
        this.isDeletingAccount = false;
        this.deleteAccountMessage =
          err?.error?.message ||
          'Something went wrong while scheduling deletion. Please try again.';
        // Modal stays open so the error is visible.
      },
    });
  }
}
