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

  isDarkMode$ = this.themeService.isDarkMode$;

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
  }

  ngOnDestroy(): void {}

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

  logout(): void {
    this.isGearOpen = false;
    this.authService.logout();
  }

  /** Close gear menu when clicking outside */
  @HostListener('document:click')
  onDocumentClick(): void {
    this.isGearOpen = false;
  }
}
