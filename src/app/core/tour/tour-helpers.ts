import { Router } from '@angular/router';
import { TourService } from 'src/app/services/tour.service';

/**
 * Close the current Driver.js instance and navigate.
 */
export function goTo(
  tourService: TourService,
  router: Router,
  path: string
): void {
  tourService.destroyCurrent();
  router.navigateByUrl(path);
}

/**
 * Generic "poll the DOM via MutationObserver until `check()` is true,
 * or timeout" primitive. Every wait-for-* helper is built on this.
 */
function waitForCondition(
  check: () => boolean,
  timeout = 2000
): Promise<boolean> {
  return new Promise((resolve) => {
    if (check()) {
      resolve(true);
      return;
    }

    let settled = false;

    const settle = (result: boolean): void => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      clearTimeout(timer);
      resolve(result);
    };

    const observer = new MutationObserver(() => {
      if (check()) settle(true);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-invalid', 'class'],
    });

    const timer = setTimeout(() => settle(check()), timeout);
  });
}

/**
 * Wait for an element to exist and be visible, then return it.
 */
export async function waitForElement(
  selector: string,
  timeout = 2000
): Promise<HTMLElement | null> {
  await waitForCondition(() => {
    const el = document.querySelector<HTMLElement>(selector);
    return !!el && el.offsetParent !== null;
  }, timeout);

  return document.querySelector<HTMLElement>(selector);
}

/**
 * Wait until an element disappears.
 * Used when a successful save removes/closes the form.
 */
export function waitForElementGone(
  selector: string,
  timeout = 2000
): Promise<boolean> {
  return waitForCondition(() => !document.querySelector(selector), timeout);
}

/**
 * Wait for either:
 * - the form disappearing => success
 * - an error element appearing => failure
 */
export function waitForSaveOutcome(
  successSelector: string,
  failureSelector: string,
  timeout = 2000
): Promise<boolean> {
  return new Promise((resolve) => {
    if (!document.querySelector(successSelector)) {
      resolve(true);
      return;
    }

    let settled = false;

    const settle = (saved: boolean): void => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      clearTimeout(timer);
      resolve(saved);
    };

    const observer = new MutationObserver(() => {
      if (!document.querySelector(successSelector)) {
        settle(true); // form gone => saved
        return;
      }
      if (document.querySelector(failureSelector)) {
        settle(false); // error shown => failed
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-invalid', 'class'],
    });

    const timer = setTimeout(() => {
      settle(!document.querySelector(successSelector));
    }, timeout);
  });
}

/**
 * Wait for the category section slide animation to finish
 * (or fall back to a fixed delay if the event never fires).
 */
export function waitForSectionSlideDone(fallbackMs = 260): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;

    const onDone = (): void => {
      if (settled) return;
      settled = true;
      document.removeEventListener('tour:sectionSlideDone', onDone);
      resolve();
    };

    document.addEventListener('tour:sectionSlideDone', onDone, { once: true });

    setTimeout(onDone, fallbackMs);
  });
}

/**
 * Advance to the next Driver.js step once its target exists.
 */
export async function advanceTo(
  selector: string,
  opts: { driver: { moveNext: () => void } }
): Promise<void> {
  await waitForElement(selector);
  opts.driver.moveNext();
}

/**
 * Advance after the category panel slide animation, then
 * once the next target exists.
 */
export async function advanceAfterSlide(
  selector: string,
  opts: { driver: { moveNext: () => void } }
): Promise<void> {
  await waitForSectionSlideDone();
  await waitForElement(selector);
  opts.driver.moveNext();
}

/**
 * Wait one animation frame — enough time for Angular to run
 * change detection and update the DOM after a click.
 */
export function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}
