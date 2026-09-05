import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  Output,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { SidebarNavComponent } from '../sidebar-nav/sidebar-nav.component';
import { ThemeToggleComponent } from '../theme-toggle/theme-toggle.component';
import { LogoComponent } from '../../logo/logo.component';
import { KeyboardShortcutsService } from '../../../services/keyboard-shortcuts.service';

@Component({
  selector: 'app-mobile-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatIconModule,
    SidebarNavComponent,
    ThemeToggleComponent,
    LogoComponent,
  ],
  templateUrl: './mobile-sidebar.component.html',
})
export class MobileSidebarComponent implements OnDestroy {
  private readonly shortcuts = inject(KeyboardShortcutsService);

  @Input() userName = 'New User';
  @Input() userEmail = '';
  @Input() userProfilePic?: string;
  @Input() isDark = false;
  @Input() isGuest = false;

  @Output() toggleTheme = new EventEmitter<void>();
  @Output() logout = new EventEmitter<void>();
  @Output() photoError = new EventEmitter<void>();
  @Output() signIn = new EventEmitter<void>();

  @ViewChild('drawer') private drawerRef?: ElementRef<HTMLElement>;
  @ViewChild('fab') private fabRef?: ElementRef<HTMLButtonElement>;

  isOpen = false;
  dragging = false;

  private previouslyFocused?: HTMLElement;
  private touchStartX = 0;
  private touchCurrentX = 0;

  toggle(): void {
    this.isOpen ? this.close() : this.open();
  }

  open(): void {
    this.isOpen = true;
    this.previouslyFocused = document.activeElement as HTMLElement;
    // Prevent the page behind the drawer from scrolling while it's open.
    document.body.style.overflow = 'hidden';
    // Wait a tick for *ngIf to render the drawer before moving focus into it.
    setTimeout(() => this.focusFirstElement(), 0);
  }

  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    document.body.style.overflow = '';
    // Return focus to the FAB so keyboard users aren't dropped at the top of the page.
    (this.previouslyFocused ?? this.fabRef?.nativeElement)?.focus();
  }

  onLogoutClick(): void {
    this.close();
    this.logout.emit();
  }

  onSignInClick(): void {
    this.close();
    this.signIn.emit();
  }

  openShortcutHelp(): void {
    this.close();
    this.shortcuts.openHelp();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isOpen) this.close();
  }

  /** Keeps Tab focus cycling inside the open drawer instead of leaking into the page behind it. */
  onTabKey(domEvent: Event): void {
    // Angular can't map the "keydown.tab" binding to KeyboardEvent in template
    // type-checking, so it types $event as Event — it's a KeyboardEvent at runtime.
    const event = domEvent as KeyboardEvent;

    const focusables =
      this.drawerRef?.nativeElement.querySelectorAll<HTMLElement>(
        'a, button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
    if (!focusables || focusables.length === 0) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  // ─── Swipe-to-close ──────────────────────────────────────
  private readonly DRAG_THRESHOLD = 10;
  private startY = 0;
  private isHorizontalSwipe = false;

  onTouchStart(event: TouchEvent): void {
    this.touchStartX = event.touches[0].clientX;
    this.touchCurrentX = this.touchStartX;
    this.startY = event.touches[0].clientY;
    this.isHorizontalSwipe = false;
    this.dragging = false;
  }

  onTouchMove(event: TouchEvent): void {
    const touch = event.touches[0];
    const deltaX = touch.clientX - this.touchStartX;
    const deltaY = touch.clientY - this.startY;

    if (!this.isHorizontalSwipe) {
      if (
        Math.abs(deltaX) > this.DRAG_THRESHOLD ||
        Math.abs(deltaY) > this.DRAG_THRESHOLD
      ) {
        this.isHorizontalSwipe = Math.abs(deltaX) > Math.abs(deltaY);
      }
    }

    if (this.isHorizontalSwipe) {
      this.dragging = true;
      this.touchCurrentX = touch.clientX;
    }
  }

  onTouchEnd(): void {
    if (this.dragging) {
      const delta = this.touchCurrentX - this.touchStartX;
      if (delta < -60) this.close();
    }
    this.dragging = false;
    this.isHorizontalSwipe = false;
  }

  /** Live drag offset while the finger is down; the panel follows the touch. */
  get dragTransform(): string | null {
    if (!this.dragging) return null;
    const delta = Math.min(0, this.touchCurrentX - this.touchStartX);
    return `translateX(${delta}px)`;
  }

  private focusFirstElement(): void {
    const el = this.drawerRef?.nativeElement.querySelector<HTMLElement>(
      'a, button, [tabindex]:not([tabindex="-1"])'
    );
    el?.focus();
  }

  ngOnDestroy(): void {
    document.body.style.overflow = '';
  }
}
