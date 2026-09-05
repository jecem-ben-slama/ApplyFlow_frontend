import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  // Light is the default until the user explicitly chooses a theme.
  private isDarkSubject = new BehaviorSubject<boolean>(false);
  isDarkMode$ = this.isDarkSubject.asObservable();

  private isBrowser: boolean;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    this.isBrowser = isPlatformBrowser(this.platformId);

    if (this.isBrowser) {
      // 1. Check if there is a user-saved preference in localStorage
      const savedTheme = localStorage.getItem('theme');

      // 2. Without a saved preference, always start in light mode.
      const finalThemeState = savedTheme === 'dark';

      this.setTheme(finalThemeState);
    }
  }

  /**
   * Toggles the application between Light and Dark mode
   */
  toggleTheme(): void {
    this.setTheme(!this.isDarkSubject.value);
  }

  /**
   * Internal mechanism to mutate DOM classes and store cache variables
   */
  private setTheme(isDark: boolean): void {
    this.isDarkSubject.next(isDark);

    if (!this.isBrowser) return;

    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }
}
