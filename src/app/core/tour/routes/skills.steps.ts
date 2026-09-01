import { Router } from '@angular/router';
import { DriveStep } from 'driver.js';
import { TourService } from 'src/app/services/tour.service';
import { advanceTo, goTo } from '../tour-helpers';
import { required } from '../tour-validation';
import { saveOrRestart } from '../tour-save';
import { fieldStep, expandStep } from '../toursteps';
import { ROUTES } from './tour-routes';
import { getApplicationsFillSteps } from './applications-fill.steps';

export function getSkillsSteps(
  tourService: TourService,
  router: Router
): DriveStep[] {
  const categoryNameFieldSelector = '#tour-category-name-field';
  const skillNameFieldSelector = '#tour-skill-name-field';

  const hasEmptyStateButton = !!document.querySelector(
    '#tour-category-add-first-btn'
  );

  const categorySteps: DriveStep[] = hasEmptyStateButton
    ? [
        expandStep(
          '#tour-category-add-first-btn',
          'Create a category',
          'Skills are grouped by category — create your first one to get started (e.g. "Frontend", "Backend").',
          categoryNameFieldSelector
        ),
      ]
    : [
        expandStep(
          '#tour-category-manage-btn',
          'Categories',
          'Skills are grouped by category. Click "Manage" to open the category panel.',
          '#tour-category-new-btn',
          /* afterSlide */ true
        ),

        expandStep(
          '#tour-category-new-btn',
          'New category',
          'Already have categories? Feel free to skip ahead — or add another one here.',
          categoryNameFieldSelector
        ),
      ];

  const steps: DriveStep[] = [
    ...categorySteps,

    fieldStep(
      categoryNameFieldSelector,
      'Name the category',
      'e.g. "Frontend", "Backend", "DevOps".',
      required('Category name', { minLength: 2, maxLength: 40 })
    ),

    {
      element: '#tour-category-save-btn',
      popover: {
        title: 'Save the category',
        description: "Once it's saved, let's add a skill to it.",
        onNextClick: (element, _step, opts) =>
          saveOrRestart({
            element: element as HTMLElement,
            hasClientError: () =>
              !!document.querySelector('#tour-category-error') === false &&
              false, // categories use ng-invalid; see note below
            formStillMountedSelector: categoryNameFieldSelector,
            formErrorSelector: '#tour-category-error',
            tourService,
            steps,
            fromIndex: steps.findIndex(
              (s) => s.element === categoryNameFieldSelector
            ),
            onSuccess: () => advanceTo('#tour-skill-toggle', opts),
          }),
      },
    },

    expandStep(
      '#tour-skill-toggle',
      'Add a skill',
      'Click here to expand the skill form.',
      skillNameFieldSelector
    ),

    fieldStep(
      skillNameFieldSelector,
      'Skill name',
      'e.g. "Next.js".',
      required('Skill name', { maxLength: 80 })
    ),

    fieldStep(
      '#tour-skill-category-field',
      'Category',
      'Assign the skill to one of your categories.',
      required('Category')
    ),

    fieldStep(
      '#tour-skill-en-field',
      'English sentence',
      'A short line describing how you used this skill — shown on English applications.',
      required('English sentence', { maxLength: 400 })
    ),

    fieldStep(
      '#tour-skill-fr-field',
      'French sentence',
      'The same line in French — shown on French applications.',
      required('French sentence', { maxLength: 400 })
    ),

    {
      element: '#tour-skill-save-btn',
      popover: {
        title: "You're all set",
        description:
          "Save this skill and you're ready to send applications. Let's head back to your applications list.",
        onNextClick: (element) =>
          saveOrRestart({
            element: element as HTMLElement,
            // IMPORTANT: SkillFormComponent does NOT use Angular's
            // ng-invalid form state — it validates synchronously
            // inside onSave() and renders #tour-skill-error itself.
            // So the "client error" check here happens *after* the
            // click (saveOrRestart already waits a frame before
            // calling this), rather than being purely a pre-click check.
            hasClientError: () => !!document.querySelector('#tour-skill-error'),
            formStillMountedSelector: skillNameFieldSelector,
            tourService,
            steps,
            fromIndex: steps.findIndex(
              (s) => s.element === skillNameFieldSelector
            ),
            onSuccess: () => {
              goTo(tourService, router, ROUTES.applications);

              // Give the router and DOM a moment to render the applications page
              // before Driver.js attempts to measure and target #tour-application-add-btn
              setTimeout(() => {
                tourService.run(getApplicationsFillSteps(tourService, router));
              }, 100);
            },
          }),
      },
    },
  ];

  return steps;
}
