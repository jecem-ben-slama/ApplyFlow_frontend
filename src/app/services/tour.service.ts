import { Injectable } from '@angular/core';
import { driver, Driver, DriveStep } from 'driver.js';


/**
 * Multi-page onboarding tour built on Driver.js.
 *
 * Driver.js only knows about a single page at a time — each route in
 * Angular destroys the previous component (and its Driver.js instance).
 * To carry a tour across /applications -> /templates -> /cv-variants ->
 * /skills, we:
 *   1. Persist a single "tour is active" flag in sessionStorage so it
 *      survives navigation (cleared automatically when the tab closes).
 *   2. Let each page run its OWN short Driver.js instance for the
 *      elements that live on that page.
 *   3. On that page's final step, override `onNextClick` to navigate to
 *      the next route instead of advancing (there's nothing left to
 *      highlight on this page).
 */
@Injectable({ providedIn: 'root' })
export class TourService {
  private static readonly ACTIVE_KEY = 'applyflow_tour_active';

  private driverObj: Driver | null = null;

  /** Whether an onboarding tour is currently in progress (persists across routes). */
  get isActive(): boolean {
    return sessionStorage.getItem(TourService.ACTIVE_KEY) === '1';
  }

  /** Call this once, from wherever the tour is triggered (e.g. a "Take a tour" button, or first login). */
  start(): void {
    sessionStorage.setItem(TourService.ACTIVE_KEY, '1');
  }

  /** Ends the tour everywhere — call this from the last step's onNextClick, or if the user skips/closes it. */
  stop(): void {
    sessionStorage.removeItem(TourService.ACTIVE_KEY);
    localStorage.setItem('applyflow_tour_completed', '1');
    this.driverObj?.destroy();
    this.driverObj = null;
  }

  /**
   * Runs a page-local set of steps. No-ops if the tour isn't active, so it's
   * safe to call unconditionally from every page's ngAfterViewInit.
   */
  run(steps: DriveStep[]): void {
    if (!this.isActive || steps.length === 0) {
      return;
    }

    this.driverObj = driver({
      showProgress: true,
      allowClose: true,
      steps,
      // Fires on Escape / clicking the backdrop / clicking the "x" — treat
      // a manual close as "user opted out of the rest of the tour".
      onCloseClick: () => this.stop(),
    });

    this.driverObj.drive();
  }

  /** Destroys the current page's Driver.js instance without clearing the "active" flag (used before navigating on). */
  destroyCurrent(): void {
    this.driverObj?.destroy();
    this.driverObj = null;
  }
}
