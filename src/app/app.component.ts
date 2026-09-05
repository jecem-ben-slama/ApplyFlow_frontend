import { Component, HostListener, inject, OnDestroy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from './services/auth.service';
import { ThemeService } from './services/theme.service';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import {
  KeyboardShortcut,
  KeyboardShortcutsService,
} from './services/keyboard-shortcuts.service';
import { Subject, takeUntil } from 'rxjs';
import { Router } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, SidebarComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements OnDestroy {
  protected authService = inject(AuthService);
  protected isShortcutsOpen = false;

  private readonly shortcuts = inject(KeyboardShortcutsService);
  private readonly router = inject(Router);
  private readonly destroy$ = new Subject<void>();

  constructor() {
    inject(ThemeService);
    this.shortcuts.shortcuts$
      .pipe(takeUntil(this.destroy$))
      .subscribe((shortcut) => this.handleShortcut(shortcut));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  closeShortcuts(): void {
    this.isShortcutsOpen = false;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isShortcutsOpen) this.closeShortcuts();
  }

  private handleShortcut(shortcut: KeyboardShortcut): void {
    if (shortcut === 'help') {
      this.isShortcutsOpen = !this.isShortcutsOpen;
      return;
    }

    if (this.isShortcutsOpen) return;

    if (shortcut === 'focus-search') {
      const search = document.querySelector<HTMLElement>(
        '[data-shortcut-search]'
      );
      search?.focus();
      return;
    }

    if (shortcut === 'new') {
      document.querySelector<HTMLElement>('[data-shortcut-new]')?.click();
      return;
    }

    if (this.authService.isAuthenticated) {
      const routes: Partial<
        Record<
          Exclude<KeyboardShortcut, 'help' | 'focus-search' | 'new'>,
          string
        >
      > = {
        dashboard: '/dashboard',
        applications: '/applications',
        attatchements: '/attatchements',
        skills: '/skills',
        templates: '/templates',
        profile: '/profile',
      };
      const route = routes[shortcut as keyof typeof routes];
      if (route) this.router.navigateByUrl(route);
    }
  }
}
