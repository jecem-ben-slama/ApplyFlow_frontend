import { Router } from '@angular/router';
import { DriveStep } from 'driver.js';
import { TourService } from 'src/app/services/tour.service';
import { goTo } from '../tour-helpers';
import { required, hasAngularValidationError } from '../tour-validation';
import { saveOrRestart } from '../tour-save';
import { ROUTES } from './tour-routes';
import { expandStep, fieldStep } from '../toursteps';

export function getCvVariantsSteps(
  tourService: TourService,
  router: Router
): DriveStep[] {
  const nameFieldSelector = '#tour-cv-name-field';

  const steps: DriveStep[] = [
    expandStep(
      '#tour-cv-add-btn',
      'Add a CV',
      'Click here to register a new CV.',
      nameFieldSelector
    ),

    fieldStep(
      nameFieldSelector,
      'Name it',
      "Give this CV variant a clear name — it's used as the PDF filename when it's attached to an application.",
      required('CV name', { maxLength: 80 })
    ),

    fieldStep(
      '#tour-cv-language-field',
      'Language',
      'Pick the language this CV is in.',
      required('Language')
    ),

    fieldStep(
      '#tour-cv-url-field',
      'Drive link',
      'Paste a shareable Google Drive link to the CV file. Tap the "?" next to the label if you need help finding it.',
      required('Drive link')
    ),

    {
      element: '#tour-cv-save-btn',
      popover: {
        title: 'Save it',
        description: "Save the CV, and we'll head over to Skills next.",
        onNextClick: (element) =>
          saveOrRestart({
            element: element as HTMLElement,
            hasClientError: () => hasAngularValidationError(nameFieldSelector),
            formStillMountedSelector: nameFieldSelector,
            tourService,
            steps,
            fromIndex: steps.findIndex((s) => s.element === nameFieldSelector),
            onSuccess: () => goTo(tourService, router, ROUTES.skills),
          }),
      },
    },
  ];

  return steps;
}
