import {
  Component,
  OnInit,
  OnDestroy,
  HostListener,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { ThemeService } from '../../services/theme.service';
import { AuthService } from '../../services/auth.service';

/** BroadcastChannel event key used to sync logout across tabs. */
const LOGOUT_CHANNEL = 'applyflow_auth';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule],
  templateUrl: './sidebar.component.html',
})
export class SidebarComponent implements OnInit, OnDestroy {
  private readonly themeService = inject(ThemeService);
  private readonly authService = inject(AuthService);

  userName = 'New User';
  userProfilePic?: string;
  isCollapsed = false;
  isGearOpen = false;
  isConfirmLogoutOpen = false;

  isDarkMode$ = this.themeService.isDarkMode$;

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

    // Listen for logout events broadcast from other tabs.
    this.logoutChannel.onmessage = (event) => {
      if (event.data === 'logout') {
        this.authService.handleCrossTabLogout();
      }
    };
  }

  ngOnDestroy(): void {
    this.logoutChannel.close();
  }

  toggleCollapse(): void {
    this.isCollapsed = !this.isCollapsed;
    if (this.isCollapsed) this.isGearOpen = false;
  }

  toggleGearMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.isGearOpen = !this.isGearOpen;
    this.isCollapsed = false;
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  /** Opens the confirmation dialog instead of logging out immediately. */
  requestLogout(): void {
    this.isGearOpen = false;
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

  @HostListener('document:click')
  onDocumentClick(): void {
    this.isGearOpen = false;
  }
}
