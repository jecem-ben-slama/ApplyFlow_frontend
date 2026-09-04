import { Router } from '@angular/router';
import { DriveStep } from 'driver.js';
import { TourService } from 'src/app/services/tour.service';
import { nextFrame, waitForElementGone, waitForElement } from '../tour-helpers';
import { required, requiredEmail } from '../tour-validation';
import { restartTourFrom } from '../tour-save';
import { expandStep, fieldStep } from '../toursteps';

const TEMPLATE_FIELD = '#field-templateId';
const COMPANY_FIELD = '#field-companyName';
const JOB_TITLE_FIELD = '#field-jobTitle';
const EMAIL_FIELD = '#field-recipientEmail';
const LANGUAGE_FIELD = '#field-language';
const CV_FIELD = '#tour-application-cv-field';
const SAVE_BTN = '#tour-application-compile-btn';
const ERROR_BANNER = '#tour-application-error';
const CV_WARNING = '#tour-application-cv-warning';


export function getApplicationsFillSteps(
  tourService: TourService,
  router: Router
): DriveStep[] {
  const steps: DriveStep[] = [
    expandStep(
      '#tour-application-add-btn',
      'Compile your first application',
      "Let's put it all together — click here to open the application form.",
      TEMPLATE_FIELD
    ),

    fieldStep(
      TEMPLATE_FIELD,
      'Pick a template',
      'This drives the subject and body of the email you send.',
      required('Template')
    ),

    fieldStep(
      COMPANY_FIELD,
      'Company',
      'Who are you applying to?',
      required('Company name', { maxLength: 100 })
    ),

    fieldStep(
      JOB_TITLE_FIELD,
      'Position',
      "The role you're applying for.",
      required('Position', { maxLength: 100 })
    ),

    fieldStep(
      EMAIL_FIELD,
      'Recipient email',
      'Where the application email will actually be sent.',
      requiredEmail('Recipient email')
    ),

    fieldStep(
      LANGUAGE_FIELD,
      'Language',
      'Matched automatically from your template, but you can change it.',
      required('Language')
    ),

    {
      element: CV_FIELD,
      popover: {
        title: 'Attach a CV (optional)',
        description:
          'Pick the CV variant you set up earlier — or skip this and compile without one.',
        // No onPopoverRender gate: this field is optional, Next stays enabled.
      },
    },

    {
      element: SAVE_BTN,
      popover: {
        title: 'Compile it',
        description:
          "This creates the application. If you skipped the CV, you'll need to click once more to confirm.",
        onNextClick: async (element, _step, _opts) => {
          const button = element as HTMLElement;

          button.click();
          await nextFrame();

          // Client-side validation failed (required field missing/invalid) —
          // the modal stays open and shows its error banner.
          if (document.querySelector(ERROR_BANNER)) {
            await restartTourFrom({
              tourService,
              steps,
              fromIndex: steps.findIndex((s) => s.element === TEMPLATE_FIELD),
            });
            return;
          }

          // No-CV confirmation gate: first click just shows a warning and
          // flips the button to "Compile Anyway" without submitting.
          // Click again now that it's confirmed.
          if (document.querySelector(CV_WARNING)) {
            const confirmBtn = await waitForElement(SAVE_BTN);
            confirmBtn?.click();
            await nextFrame();

            if (document.querySelector(ERROR_BANNER)) {
              await restartTourFrom({
                tourService,
                steps,
                fromIndex: steps.findIndex((s) => s.element === TEMPLATE_FIELD),
              });
              return;
            }
          }

          // Wait for the modal to actually close (isModalOpen -> false).
          const saved = await waitForElementGone(COMPANY_FIELD, 2500);

          if (!saved) {
            await restartTourFrom({
              tourService,
              steps,
              fromIndex: steps.findIndex((s) => s.element === TEMPLATE_FIELD),
            });
            return;
          }
          localStorage.setItem('applyflow_tour_completed', 'true');

          tourService.stop();
        },
      },
    },
  ];

  return steps;
}
