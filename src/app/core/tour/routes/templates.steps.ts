import { Router } from '@angular/router';
import { DriveStep } from 'driver.js';
import { TourService } from 'src/app/services/tour.service';
import { goTo } from '../tour-helpers';
import { required, hasAngularValidationError } from '../tour-validation';
import { saveOrRestart } from '../tour-save';
import { fieldStep, expandStep } from '../toursteps';
import { ROUTES } from './tour-routes';

export function getTemplatesSteps(
  tourService: TourService,
  router: Router
): DriveStep[] {
  const nameFieldSelector = '#tour-template-name-field';

  const steps: DriveStep[] = [
    expandStep(
      '#tour-template-toggle',
      'Create a template',
      'Click here to expand the template form.',
      nameFieldSelector
    ),

    fieldStep(
      nameFieldSelector,
      'Name it',
      'A label for you to recognize this template by later — e.g. "Follow-up Standard".',
      required('Template name', { maxLength: 80 })
    ),

    fieldStep(
      '#tour-template-language-field',
      'Language',
      'Pick the language this template is written in.',
      required('Language')
    ),

    fieldStep(
      '#tour-template-subject-field',
      'Subject line',
      'The email subject. Use the placeholder buttons above the field to insert dynamic values like the company name.',
      required('Subject line', { maxLength: 150 })
    ),

    fieldStep(
      '#tour-template-body-field',
      'Body',
      'The email body. Placeholders work here too — and any skills you attach later get appended automatically if you skip {{skills_block}}.',
      required('Body', { minLength: 10, maxLength: 5000 })
    ),

    {
      element: '#tour-template-save-btn',
      popover: {
        title: 'Save it',
        description: "Save the template, and we'll head over to CVs next.",
        onNextClick: (element) =>
          saveOrRestart({
            element: element as HTMLElement,
            hasClientError: () => hasAngularValidationError(nameFieldSelector),
            formStillMountedSelector: nameFieldSelector,
            formErrorSelector: '#tour-template-error',
            tourService,
            steps,
            fromIndex: steps.findIndex((s) => s.element === nameFieldSelector),
            onSuccess: () => goTo(tourService, router, ROUTES.cvVariants),
          }),
      },
    },
  ];

  return steps;
}
