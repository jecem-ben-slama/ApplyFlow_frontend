import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';

// ⚠️ Adjust these two import paths to match your project structure.
import { ThemeService } from '../../services/theme.service';
import { AuthService } from '../../services/auth.service';
import { ThemeToggleComponent } from '../sidebar/theme-toggle/theme-toggle.component';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatIconModule,
    ThemeToggleComponent,
  ],
  templateUrl: './profile.component.html',
})
export class ProfileComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly themeService = inject(ThemeService);
  private readonly router = inject(Router);

  // ⚠️ These field names assume AuthService's User model exposes firstName /
  // lastName / username / email. Update to match whatever your API actually returns.
  firstName = '';
  lastName = '';
  username = '';
  email = '';
  userProfilePic?: string;

  isDarkMode$ = this.themeService.isDarkMode$;

  // ─── Danger zone ───
  confirmText = '';
  isDeleting = false;
  deleteError = '';

  private userSub?: Subscription;

  ngOnInit(): void {
    this.userSub = this.authService.currentUser$.subscribe((user) => {
      if (!user) return;
      this.firstName = user.firstName ?? '';
      this.lastName = user.lastName ?? '';
      this.email = user.email ?? '';
      this.userProfilePic = user.pictureUrl || undefined;
    });
  }

  ngOnDestroy(): void {
    this.userSub?.unsubscribe();
  }

  get displayName(): string {
    return (
      `${this.firstName} ${this.lastName}`.trim() || this.username || 'User'
    );
  }

  /** The exact phrase the user must type: "delete " + their real email. */
  get expectedConfirmation(): string {
    return `delete ${this.email}`.trim().toLowerCase();
  }

  get canDelete(): boolean {
    return (
      !!this.email &&
      this.confirmText.trim().toLowerCase() === this.expectedConfirmation
    );
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  onPhotoError(): void {
    this.userProfilePic = undefined;
  }

  goBack(): void {
    this.router.navigate(['/']);
  }

  deleteAccount(): void {
    // This client-side check only gates the button so people don't fire the
    // request by accident. The backend must independently verify the typed
    // phrase against the account's real email before scheduling deletion —
    // never trust the client's "canDelete" as the source of truth.
    if (!this.canDelete || this.isDeleting) return;

    this.isDeleting = true;
    this.deleteError = '';

    this.authService.deleteAccount(this.confirmText.trim()).subscribe({
      next: () => {
        this.isDeleting = false;
        this.router
          .navigate(['/login'], {
            queryParams: { accountDeletion: 'scheduled' },
          })
          .then(() => window.location.reload());
      },
      error: (err) => {
        this.isDeleting = false;
        this.deleteError =
          err?.error?.message ||
          'Something went wrong while scheduling deletion. Please try again.';
      },
    });
  }
}
