// profile.component.ts
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

import { TourService } from '../../services/tour.service';
import {
  getApplicationsSteps,
  getTemplatesSteps,
  getCvVariantsSteps,
  getSkillsSteps,
  getApplicationsFillSteps,
} from 'src/app/core/tour';

type TourPage = 'applications' | 'templates' | 'cv-variants' | 'skills';

interface TourPageMeta {
  id: TourPage;
  label: string;
  route: string;
  icon: string;
}

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
  private readonly tourService = inject(TourService);

  // ⚠️ These field names assume AuthService's User model exposes firstName /
  // lastName / username / email. Update to match whatever your API actually returns.
  firstName = '';
  lastName = '';
  username = '';
  email = '';
  userProfilePic?: string;

  isDarkMode$ = this.themeService.isDarkMode$;

  // ─── Take a tour ───
  readonly tourPages: TourPageMeta[] = [
    {
      id: 'applications',
      label: 'Applications',
      route: '/applications',
      icon: 'inventory_2',
    },
    {
      id: 'templates',
      label: 'Templates',
      route: '/templates',
      icon: 'description',
    },
    { id: 'cv-variants', label: 'CVs', route: '/cv-variants', icon: 'badge' },
    { id: 'skills', label: 'Skills', route: '/skills', icon: 'star' },
  ];

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

  /**
   * Starts the multi-page onboarding tour beginning at `page`.
   *
   * TourService.run() only actually fires steps when the destination
   * page's own load path calls it (see each page's ngAfterViewInit /
   * subscribe callback in skills.component.ts etc), gated on
   * tourService.isActive. So "start from X" is: turn the tour on, then
   * get the user onto X's route.
   *
   * If the user is already sitting on that exact route, router navigation
   * to the same URL is a no-op and won't re-trigger that page's lifecycle
   * hook — so in that case we call the page's own getXSteps() + run()
   * directly instead of navigating.
   *
   * If we're navigating away to a DIFFERENT route, the destination page's
   * elements don't exist yet, so we can't call run() here — instead we
   * pass which page we meant via router navigation state (`tourTarget`).
   * The destination component reads `history.state.tourTarget` in its own
   * ngAfterViewInit and, if it matches, calls run() itself with the right
   * steps. This is deliberately NOT routed through TourService.isActive,
   * since that flag is also used (and already works) for the separate
   * "mid-chain" case of one tour step navigating to the next page.
   */
  startTour(page: TourPage): void {
    const meta = this.tourPages.find((p) => p.id === page);
    if (!meta) return;

    this.tourService.start();

    const currentPath = this.router.url.split('?')[0].split('#')[0];
    if (currentPath === meta.route) {
      this.tourService.run(this.getStepsFor(page));
    } else {
      this.router.navigateByUrl(meta.route, { state: { tourTarget: page } });
    }
  }

  private getStepsFor(page: TourPage) {
    switch (page) {
      case 'applications':
        return getApplicationsFillSteps(this.tourService, this.router);
      case 'templates':
        return getTemplatesSteps(this.tourService, this.router);
      case 'cv-variants':
        return getCvVariantsSteps(this.tourService, this.router);
      case 'skills':
        return getSkillsSteps(this.tourService, this.router);
    }
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
