
import { Router } from '@angular/router';
import { DriveStep } from 'driver.js';
import { TourService } from './tour.service';

/**
 * Tour flow:
 *
 * /applications
 *      ↓
 * /templates
 *      ↓
 * /cv-variants
 *      ↓
 * /skills
 *      ↓
 * /applications
 *
 * Each route owns its own Driver.js instance.
 */

/**
 * Close the current Driver.js instance and navigate.
 */
function goTo(
  tourService: TourService,
  router: Router,
  path: string
): void {
  tourService.destroyCurrent();
  router.navigateByUrl(path);
}

/**
 * Wait for an element to exist and be visible.
 */
function waitForElement(
  selector: string,
  timeout = 2000
): Promise<HTMLElement | null> {
  return new Promise((resolve) => {
    const existing =
      document.querySelector<HTMLElement>(
        selector
      );

    if (
      existing &&
      existing.offsetParent !== null
    ) {
      resolve(existing);
      return;
    }

    const observer =
      new MutationObserver(() => {
        const el =
          document.querySelector<HTMLElement>(
            selector
          );

        if (
          el &&
          el.offsetParent !== null
        ) {
          observer.disconnect();
          resolve(el);
        }
      });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    });

    setTimeout(() => {
      observer.disconnect();

      resolve(
        document.querySelector<HTMLElement>(
          selector
        )
      );
    }, timeout);
  });
}

/**
 * Wait until an element disappears.
 *
 * Used when a successful save removes/closes the form.
 */
function waitForElementGone(
  selector: string,
  timeout = 2000
): Promise<boolean> {
  return new Promise((resolve) => {
    if (
      !document.querySelector(selector)
    ) {
      resolve(true);
      return;
    }

    const observer =
      new MutationObserver(() => {
        if (
          !document.querySelector(selector)
        ) {
          observer.disconnect();
          resolve(true);
        }
      });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    setTimeout(() => {
      observer.disconnect();

      resolve(
        !document.querySelector(selector)
      );
    }, timeout);
  });
}

/**
 * Wait for either:
 *
 * - the form disappearing => success
 * - an error element appearing => failure
 */
function waitForSaveOutcome(
  successSelector: string,
  failureSelector: string,
  timeout = 2000
): Promise<boolean> {
  return new Promise((resolve) => {
    if (
      !document.querySelector(
        successSelector
      )
    ) {
      resolve(true);
      return;
    }

    let settled = false;

    let observer: MutationObserver;

    const settle = (
      saved: boolean
    ): void => {
      if (settled) return;

      settled = true;

      observer.disconnect();
      clearTimeout(timer);

      resolve(saved);
    };

    observer =
      new MutationObserver(() => {
        /*
         * Form disappeared.
         * Save succeeded.
         */
        if (
          !document.querySelector(
            successSelector
          )
        ) {
          settle(true);
          return;
        }

        /*
         * Error appeared.
         * Save failed.
         */
        if (
          document.querySelector(
            failureSelector
          )
        ) {
          settle(false);
        }
      });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        'aria-invalid',
        'class',
      ],
    });

    const timer = setTimeout(() => {
      settle(
        !document.querySelector(
          successSelector
        )
      );
    }, timeout);
  });
}

/**
 * Wait for the category section animation.
 */
function waitForSectionSlideDone(
  fallbackMs = 260
): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;

    const onDone = () => {
      if (settled) return;

      settled = true;

      document.removeEventListener(
        'tour:sectionSlideDone',
        onDone
      );

      resolve();
    };

    document.addEventListener(
      'tour:sectionSlideDone',
      onDone,
      {
        once: true,
      }
    );

    setTimeout(() => {
      if (settled) return;

      settled = true;

      document.removeEventListener(
        'tour:sectionSlideDone',
        onDone
      );

      resolve();
    }, fallbackMs);
  });
}

/**
 * Advance to the next Driver.js step after
 * its target exists.
 */
async function advanceTo(
  selector: string,
  opts: { driver: any }
): Promise<void> {
  await waitForElement(selector);

  opts.driver.moveNext();
}

/**
 * Advance after the category panel animation.
 */
async function advanceAfterSlide(
  selector: string,
  opts: { driver: any }
): Promise<void> {
  await waitForSectionSlideDone();

  await waitForElement(selector);

  opts.driver.moveNext();
}

/**
 * Read a field's current value.
 */
function getFieldValue(
  el: Element | null
): string {
  if (!el) return '';

  if (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement
  ) {
    return el.value.trim();
  }

  return (
    el.textContent ?? ''
  ).trim();
}

type FieldValidator = (
  value: string
) => string | null;

/**
 * Required-field validator.
 */
function required(
  label: string,
  bounds?: {
    minLength?: number;
    maxLength?: number;
  }
): FieldValidator {
  return (value) => {
    if (!value) {
      return `${label} can't be empty.`;
    }

    if (
      bounds?.minLength &&
      value.length <
        bounds.minLength
    ) {
      return `${label} should be at least ${bounds.minLength} characters.`;
    }

    if (
      bounds?.maxLength &&
      value.length >
        bounds.maxLength
    ) {
      return `${label} should be ${bounds.maxLength} characters or fewer.`;
    }

    return null;
  };
}

/**
 * Disable Driver.js Next while the current
 * field is invalid.
 */
function gateNextOnValid(
  fieldSelector: string,
  validate: FieldValidator
) {
  return (popover: any): void => {
    const field =
      document.querySelector<HTMLElement>(
        fieldSelector
      );

    const nextBtn:
      | HTMLButtonElement
      | undefined =
      popover?.nextButton;

    if (!field || !nextBtn) return;

    let errorEl =
      field.parentElement?.querySelector<HTMLElement>(
        '.tour-field-error'
      );

    if (!errorEl) {
      errorEl =
        document.createElement(
          'div'
        );

      errorEl.className =
        'tour-field-error';

      errorEl.style.color =
        '#dc2626';

      errorEl.style.fontSize =
        '12px';

      errorEl.style.marginTop =
        '4px';

      field.insertAdjacentElement(
        'afterend',
        errorEl
      );
    }

    const sync = (): void => {
      const error =
        validate(
          getFieldValue(field)
        );

      nextBtn.disabled =
        !!error;

      nextBtn.title =
        error ?? '';

      field.setAttribute(
        'aria-invalid',
        String(!!error)
      );

      errorEl!.textContent =
        error ?? '';
    };

    sync();

    field.addEventListener(
      'input',
      sync
    );

    field.addEventListener(
      'change',
      sync
    );

    field.addEventListener(
      'blur',
      sync
    );
  };
}

/**
 * Detect Angular validation errors.
 *
 * Used by forms that use Angular's built-in
 * ng-invalid state.
 */
function hasAngularValidationError(
  formStillMountedSelector: string
): boolean {
  const anchor =
    document.querySelector(
      formStillMountedSelector
    );

  if (!anchor) {
    return false;
  }

  const form =
    anchor.closest('form');

  if (!form) {
    return false;
  }

  return !!form.querySelector(
    'input.ng-invalid, textarea.ng-invalid, select.ng-invalid'
  );
}

/**
 * Restart the current tour immediately.
 */
async function restartTourFrom(
  params: {
    tourService: TourService;
    steps: DriveStep[];
    fromIndex: number;
  }
): Promise<void> {
  params.tourService
    .destroyCurrent();

  /*
   * Give Angular one frame to finish
   * rendering validation messages.
   */
  await new Promise<void>(
    (resolve) => {
      requestAnimationFrame(() => {
        resolve();
      });
    }
  );

  params.tourService.run(
    params.steps.slice(
      Math.max(
        params.fromIndex,
        0
      )
    )
  );
}

/**
 * Save handler used by the template,
 * CV and category forms.
 *
 * Client-side validation is checked first,
 * avoiding unnecessary waits.
 */
async function saveOrRestart(
  params: {
    element: HTMLElement;

    formStillMountedSelector: string;

    formErrorSelector?: string;

    tourService: TourService;

    steps: DriveStep[];

    fromIndex: number;

    onSuccess:
      () =>
        | void
        | Promise<void>;
  }
): Promise<void> {
  params.element.click();

  /*
   * Give Angular one frame to process
   * validation and update the DOM.
   */
  await new Promise<void>(
    (resolve) => {
      requestAnimationFrame(() => {
        resolve();
      });
    }
  );

  /*
   * Angular forms:
   *
   * Detect .ng-invalid immediately.
   */
  if (
    hasAngularValidationError(
      params.formStillMountedSelector
    )
  ) {
    await restartTourFrom({
      tourService:
        params.tourService,

      steps: params.steps,

      fromIndex:
        params.fromIndex,
    });

    return;
  }

  /*
   * Wait for a real save outcome.
   */
  const saved =
    params.formErrorSelector
      ? await waitForSaveOutcome(
          params.formStillMountedSelector,
          params.formErrorSelector,
          2000
        )
      : await waitForElementGone(
          params.formStillMountedSelector,
          2000
        );

  if (!saved) {
    await restartTourFrom({
      tourService:
        params.tourService,

      steps: params.steps,

      fromIndex:
        params.fromIndex,
    });

    return;
  }

  await params.onSuccess();
}

// ---------------------------------------------------------------------------
// /applications
// ---------------------------------------------------------------------------

export function getApplicationsSteps(
  tourService: TourService,
  router: Router
): DriveStep[] {
  return [
    {
      element:
        '#tour-applications-intro',

      popover: {
        title:
          'Welcome to ApplyFlow',

        description:
          "This is where every application you send ends up. Before you compile your first one, let's set up a template and a CV — click Next to head to Templates.",

        onNextClick: () =>
          goTo(
            tourService,
            router,
            '/templates'
          ),
      },
    },
  ];
}

// ---------------------------------------------------------------------------
// /templates
// ---------------------------------------------------------------------------

export function getTemplatesSteps(
  tourService: TourService,
  router: Router
): DriveStep[] {
  const steps: DriveStep[] = [
    {
      element:
        '#tour-template-toggle',

      popover: {
        title:
          'Create a template',

        description:
          'Click here to expand the template form.',

        onNextClick: (
          element,
          _step,
          opts
        ) => {
          (
            element as HTMLElement
          ).click();

          setTimeout(
            () =>
              opts.driver.moveNext(),
            300
          );
        },
      },
    },

    {
      element:
        '#tour-template-name-field',

      popover: {
        title:
          'Name it',

        description:
          'A label for you to recognize this template by later — e.g. "Follow-up Standard".',

        onPopoverRender:
          gateNextOnValid(
            '#tour-template-name-field',
            required(
              'Template name',
              {
                maxLength: 80,
              }
            )
          ),
      },
    },

    {
      element:
        '#tour-template-language-field',

      popover: {
        title:
          'Language',

        description:
          'Pick the language this template is written in.',

        onPopoverRender:
          gateNextOnValid(
            '#tour-template-language-field',
            required(
              'Language'
            )
          ),
      },
    },

    {
      element:
        '#tour-template-subject-field',

      popover: {
        title:
          'Subject line',

        description:
          'The email subject. Use the placeholder buttons above the field to insert dynamic values like the company name.',

        onPopoverRender:
          gateNextOnValid(
            '#tour-template-subject-field',
            required(
              'Subject line',
              {
                maxLength: 150,
              }
            )
          ),
      },
    },

    {
      element:
        '#tour-template-body-field',

      popover: {
        title:
          'Body',

        description:
          'The email body. Placeholders work here too — and any skills you attach later get appended automatically if you skip {{skills_block}}.',

        onPopoverRender:
          gateNextOnValid(
            '#tour-template-body-field',
            required(
              'Body',
              {
                minLength: 10,
                maxLength: 5000,
              }
            )
          ),
      },
    },

    {
      element:
        '#tour-template-save-btn',

      popover: {
        title:
          'Save it',

        description:
          "Save the template, and we'll head over to CVs next.",

        onNextClick: (
          element,
          _step,
          _opts
        ) =>
          saveOrRestart({
            element:
              element as HTMLElement,

            formStillMountedSelector:
              '#tour-template-name-field',

            formErrorSelector:
              '#tour-template-error',

            tourService,

            steps,

            fromIndex:
              nameFieldIndex,

            onSuccess: () =>
              goTo(
                tourService,
                router,
                '/cv-variants'
              ),
          }),
      },
    },
  ];

  const nameFieldIndex =
    steps.findIndex(
      (s) =>
        s.element ===
        '#tour-template-name-field'
    );

  return steps;
}

// ---------------------------------------------------------------------------
// /cv-variants
// ---------------------------------------------------------------------------

export function getCvVariantsSteps(
  tourService: TourService,
  router: Router
): DriveStep[] {
  const steps: DriveStep[] = [
    {
      element:
        '#tour-cv-add-btn',

      popover: {
        title:
          'Add a CV',

        description:
          'Click here to register a new CV variant.',

        onNextClick: (
          element,
          _step,
          opts
        ) => {
          (
            element as HTMLElement
          ).click();

          setTimeout(
            () =>
              opts.driver.moveNext(),
            300
          );
        },
      },
    },

    {
      element:
        '#tour-cv-name-field',

      popover: {
        title:
          'Name it',

        description:
          "Give this CV variant a clear name — it's used as the PDF filename when it's attached to an application.",

        onPopoverRender:
          gateNextOnValid(
            '#tour-cv-name-field',
            required(
              'CV name',
              {
                maxLength: 80,
              }
            )
          ),
      },
    },

    {
      element:
        '#tour-cv-language-field',

      popover: {
        title:
          'Language',

        description:
          'Pick the language this CV is written in.',

        onPopoverRender:
          gateNextOnValid(
            '#tour-cv-language-field',
            required(
              'Language'
            )
          ),
      },
    },

    {
      element:
        '#tour-cv-url-field',

      popover: {
        title:
          'Drive link',

        description:
          'Paste a shareable Google Drive link to the CV file. Tap the "?" next to the label if you need help finding it.',

        onPopoverRender:
          gateNextOnValid(
            '#tour-cv-url-field',
            required(
              'Drive link'
            )
          ),
      },
    },

    {
      element:
        '#tour-cv-save-btn',

      popover: {
        title:
          'Save it',

        description:
          "Save the CV, and we'll head over to Skills next.",

        onNextClick: (
          element,
          _step,
          _opts
        ) =>
          saveOrRestart({
            element:
              element as HTMLElement,

            formStillMountedSelector:
              '#tour-cv-name-field',

            tourService,

            steps,

            fromIndex:
              nameFieldIndex,

            onSuccess: () =>
              goTo(
                tourService,
                router,
                '/skills'
              ),
          }),
      },
    },
  ];

  const nameFieldIndex =
    steps.findIndex(
      (s) =>
        s.element ===
        '#tour-cv-name-field'
    );

  return steps;
}

// ---------------------------------------------------------------------------
// /skills
// ---------------------------------------------------------------------------

export function getSkillsSteps(
  tourService: TourService,
  router: Router
): DriveStep[] {
  const hasEmptyStateButton =
    !!document.querySelector(
      '#tour-category-add-first-btn'
    );

  const categorySteps:
    DriveStep[] =
    hasEmptyStateButton
      ? [
          {
            element:
              '#tour-category-add-first-btn',

            popover: {
              title:
                'Create a category',

              description:
                'Skills are grouped by category — create your first one to get started (e.g. "Frontend", "Backend").',

              onNextClick:
                async (
                  element,
                  _step,
                  opts
                ) => {
                  (
                    element as HTMLElement
                  ).click();

                  await advanceTo(
                    '#tour-category-name-field',
                    opts
                  );
                },
            },
          },
        ]
      : [
          {
            element:
              '#tour-category-manage-btn',

            popover: {
              title:
                'Categories',

              description:
                'Skills are grouped by category. Click "Manage" to open the category panel.',

              onNextClick:
                async (
                  element,
                  _step,
                  opts
                ) => {
                  (
                    element as HTMLElement
                  ).click();

                  await advanceAfterSlide(
                    '#tour-category-new-btn',
                    opts
                  );
                },
            },
          },

          {
            element:
              '#tour-category-new-btn',

            popover: {
              title:
                'New category',

              description:
                'Already have categories? Feel free to skip ahead — or add another one here.',

              onNextClick:
                async (
                  element,
                  _step,
                  opts
                ) => {
                  (
                    element as HTMLElement
                  ).click();

                  await advanceTo(
                    '#tour-category-name-field',
                    opts
                  );
                },
            },
          },
        ];

  const steps: DriveStep[] = [
    ...categorySteps,

    {
      element:
        '#tour-category-name-field',

      popover: {
        title:
          'Name the category',

        description:
          'e.g. "Frontend", "Backend", "DevOps".',

        onPopoverRender:
          gateNextOnValid(
            '#tour-category-name-field',
            required(
              'Category name',
              {
                minLength: 2,
                maxLength: 40,
              }
            )
          ),
      },
    },

    {
      element:
        '#tour-category-save-btn',

      popover: {
        title:
          'Save the category',

        description:
          "Once it's saved, let's add a skill to it.",

        onNextClick: (
          element,
          _step,
          opts
        ) =>
          saveOrRestart({
            element:
              element as HTMLElement,

            formStillMountedSelector:
              '#tour-category-name-field',

            formErrorSelector:
              '#tour-category-error',

            tourService,

            steps,

            fromIndex:
              categoryNameFieldIndex,

            onSuccess: () =>
              advanceTo(
                '#tour-skill-toggle',
                opts
              ),
          }),
      },
    },

    {
      element:
        '#tour-skill-toggle',

      popover: {
        title:
          'Add a skill',

        description:
          'Click here to expand the skill form.',

        onNextClick:
          async (
            element,
            _step,
            opts
          ) => {
            (
              element as HTMLElement
            ).click();

            await advanceTo(
              '#tour-skill-name-field',
              opts
            );
          },
      },
    },

    {
      element:
        '#tour-skill-name-field',

      popover: {
        title:
          'Skill name',

        description:
          'e.g. "Next.js".',

        onPopoverRender:
          gateNextOnValid(
            '#tour-skill-name-field',
            required(
              'Skill name',
              {
                maxLength: 80,
              }
            )
          ),
      },
    },

    {
      element:
        '#tour-skill-category-field',

      popover: {
        title:
          'Category',

        description:
          'Assign the skill to one of your categories.',

        onPopoverRender:
          gateNextOnValid(
            '#tour-skill-category-field',
            required(
              'Category'
            )
          ),
      },
    },

    {
      element:
        '#tour-skill-en-field',

      popover: {
        title:
          'English sentence',

        description:
          'A short line describing how you used this skill — shown on English applications.',

        onPopoverRender:
          gateNextOnValid(
            '#tour-skill-en-field',
            required(
              'English sentence',
              {
                maxLength: 400,
              }
            )
          ),
      },
    },

    {
      element:
        '#tour-skill-fr-field',

      popover: {
        title:
          'French sentence',

        description:
          'The same line in French — shown on French applications.',

        onPopoverRender:
          gateNextOnValid(
            '#tour-skill-fr-field',
            required(
              'French sentence',
              {
                maxLength: 400,
              }
            )
          ),
      },
    },

    {
      element:
        '#tour-skill-save-btn',

      popover: {
        title:
          "You're all set",

        description:
          "Save this skill and you're ready to send applications. Let's head back to your applications list.",

        onNextClick:
          async (
            element,
            _step,
            _opts
          ) => {
            const saveButton =
              element as HTMLElement;

            /*
             * IMPORTANT:
             *
             * SkillFormComponent does NOT use
             * Angular's ng-invalid form state.
             *
             * It performs its own synchronous
             * validation inside onSave().
             *
             * Therefore we click first, then
             * check the actual skill error element.
             */
            saveButton.click();

            /*
             * Give Angular a microtask/frame to
             * render displayedErrorMessage.
             */
            await new Promise<void>(
              (resolve) => {
                requestAnimationFrame(
                  () => resolve()
                );
              }
            );

            /*
             * Client-side validation failed.
             *
             * #tour-skill-error is rendered by:
             *
             * *ngIf="displayedErrorMessage"
             *
             * so its presence means onSave()
             * rejected the form before making
             * the HTTP request.
             */
            if (
              document.querySelector(
                '#tour-skill-error'
              )
            ) {
              await restartTourFrom({
                tourService,

                steps,

                fromIndex:
                  skillNameFieldIndex,
              });

              return;
            }

            /*
             * Validation passed.
             *
             * Now wait for the actual save
             * operation to finish.
             */
            const saved =
              await waitForElementGone(
                '#tour-skill-name-field',
                2000
              );

            if (!saved) {
              await restartTourFrom({
                tourService,

                steps,

                fromIndex:
                  skillNameFieldIndex,
              });

              return;
            }

            /*
             * Everything succeeded.
             */
            tourService.stop();

            router.navigateByUrl(
              '/applications'
            );
          },
      },
    },
  ];

  const categoryNameFieldIndex =
    steps.findIndex(
      (s) =>
        s.element ===
        '#tour-category-name-field'
    );

  const skillNameFieldIndex =
    steps.findIndex(
      (s) =>
        s.element ===
        '#tour-skill-name-field'
    );

  return steps;
}

