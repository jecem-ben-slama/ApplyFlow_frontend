import { DriveStep } from 'driver.js';
import { FieldValidator, gateNextOnValid } from './tour-validation';
import {
  advanceAfterSlide,
  advanceTo,
  waitForSectionSlideDone,
} from './tour-helpers';

/**
 * A step that points at a form field, with client-side validation
 * gating the "Next" button.
 */
export function fieldStep(
  selector: string,
  title: string,
  description: string,
  validate: FieldValidator
): DriveStep {
  return {
    element: selector,
    popover: {
      title,
      description,
      onPopoverRender: gateNextOnValid(selector, validate),
    },
  };
}

/**
 * A step that clicks a toggle/add button to reveal a form, then
 * advances once the next target selector appears.
 *
 * `afterSlide: true` waits for the category panel's slide
 * animation before checking for the target.
 */
export function expandStep(
  selector: string,
  title: string,
  description: string,
  nextTargetSelector: string,
  afterSlide = false
): DriveStep {
  return {
    element: selector,
    popover: {
      title,
      description,
      onNextClick: async (element, _step, opts) => {
        (element as HTMLElement).click();

        if (afterSlide) {
          await advanceAfterSlide(nextTargetSelector, opts);
        } else {
          await advanceTo(nextTargetSelector, opts);
        }
      },
    },
  };
}
