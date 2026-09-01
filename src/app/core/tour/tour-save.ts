import { DriveStep } from 'driver.js';
import { TourService } from 'src/app/services/tour.service';
import {
  nextFrame,
  waitForElementGone,
  waitForSaveOutcome,
} from './tour-helpers';

/**
 * Restart the current tour from a given step index.
 * Used when a save attempt fails validation or the request itself.
 */
export async function restartTourFrom(params: {
  tourService: TourService;
  steps: DriveStep[];
  fromIndex: number;
}): Promise<void> {
  params.tourService.destroyCurrent();

  // Give Angular one frame to finish rendering validation messages.
  await nextFrame();

  params.tourService.run(params.steps.slice(Math.max(params.fromIndex, 0)));
}

/**
 * Shared save handler for the template, CV and category forms.
 *
 * `hasClientError` lets each caller supply its own way of detecting
 * client-side validation failure (Angular's ng-invalid state, a
 * component's own error element, etc.) before falling back to
 * waiting on the actual save request outcome.
 */
export async function saveOrRestart(params: {
  element: HTMLElement;

  hasClientError: () => boolean;

  formStillMountedSelector: string;
  formErrorSelector?: string;

  tourService: TourService;
  steps: DriveStep[];
  fromIndex: number;

  onSuccess: () => void | Promise<void>;
}): Promise<void> {
  params.element.click();

  // Give Angular one frame to process validation and update the DOM.
  await nextFrame();

  if (params.hasClientError()) {
    await restartTourFrom({
      tourService: params.tourService,
      steps: params.steps,
      fromIndex: params.fromIndex,
    });
    return;
  }

  // Wait for a real save outcome (request success/failure).
  const saved = params.formErrorSelector
    ? await waitForSaveOutcome(
        params.formStillMountedSelector,
        params.formErrorSelector,
        2000
      )
    : await waitForElementGone(params.formStillMountedSelector, 2000);

  if (!saved) {
    await restartTourFrom({
      tourService: params.tourService,
      steps: params.steps,
      fromIndex: params.fromIndex,
    });
    return;
  }

  await params.onSuccess();
}
