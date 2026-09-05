import { Injectable, inject } from '@angular/core';
import { driver, Driver, DriveStep } from 'driver.js';
import { KeyboardShortcutsService } from './keyboard-shortcuts.service';

/**
 * Multi-page onboarding tour built on Driver.js.
 *
 * Driver.js only knows about a single page at a time — each route in
 * Angular destroys the previous component (and its Driver.js instance).
 * To carry a tour across /applications -> /templates -> /cv-variants ->
 * /skills, we:
 *
 *   1. Persist a single "tour is active" flag in sessionStorage so it
 *      survives navigation (cleared automatically when the tab closes).
 *
 *   2. Let each page run its OWN short Driver.js instance for the
 *      elements that live on that page.
 *
 *   3. On that page's final step, override `onNextClick` to navigate
 *      to the next route instead of advancing.
 *
 * Closing behavior:
 *
 *   X button       -> closes the tour
 *   Escape         -> ignored
 *   Backdrop click -> ignored
 */
@Injectable({ providedIn: 'root' })
export class TourService {
  private static readonly ACTIVE_KEY = 'applyflow_tour_active';

  private driverObj: Driver | null = null;
  private readonly keyboardShortcuts = inject(KeyboardShortcutsService);

  /**
   * Whether an onboarding tour is currently in progress.
   */
  get isActive(): boolean {
    return sessionStorage.getItem(TourService.ACTIVE_KEY) === '1';
  }

  /**
   * Starts the onboarding tour.
   */
  start(): void {
    sessionStorage.setItem(TourService.ACTIVE_KEY, '1');
    this.keyboardShortcuts.pause();
  }

  /**
   * Completely ends the tour.
   *
   * Called when the user clicks the X button
   * or when the tour is successfully completed.
   */
  stop(): void {
    sessionStorage.removeItem(TourService.ACTIVE_KEY);

    localStorage.setItem('applyflow_tour_completed', '1');

    this.driverObj?.destroy();
    this.driverObj = null;
    this.keyboardShortcuts.resume();
  }

  /**
   * Runs a page-local set of steps.
   *
   * Closing behavior:
   *
   *   X button       -> closes
   *   Escape         -> ignored
   *   Backdrop click -> ignored
   */
  run(steps: DriveStep[]): void {
    if (!this.isActive || steps.length === 0) {
      return;
    }

    this.keyboardShortcuts.pause();

    /*
     * Destroy any previous page-local
     * Driver.js instance.
     */
    this.driverObj?.destroy();
    this.driverObj = null;

    this.driverObj = driver({
      showProgress: true,

      /*
       * Keep this TRUE so the X close button
       * remains available.
       */
      allowClose: true,

      /*
       * Disable keyboard control.
       *
       * This prevents Escape from closing
       * or otherwise controlling the tour.
       */
      allowKeyboardControl: false,

      /*
       * Override the default backdrop behavior.
       *
       * Driver.js normally closes the tour when
       * the overlay is clicked.
       *
       * An empty callback means:
       * "Do nothing when the backdrop is clicked."
       */
      overlayClickBehavior: () => {},

      steps,

      /*
       * This callback belongs specifically to
       * the X close button.
       *
       * Because we have not disabled allowClose,
       * the close button remains functional.
       */
      onCloseClick: () => {
        this.stop();
      },
    });

    this.driverObj.drive();
  }

  /**
   * Destroys the current page's Driver.js instance
   * without clearing the active tour flag.
   *
   * Used before navigating to another route.
   */
  destroyCurrent(): void {
    this.driverObj?.destroy();
    this.driverObj = null;
  }
}
