import { Router } from '@angular/router';
import { DriveStep } from 'driver.js';
import { TourService } from './tour.service';

/**
 * Tour flow: /applications -> /templates (create) -> /cv-variants (add) -> /skills -> /applications
 *
 * Each function below returns the Driver.js steps for ONE page. Wire them up
 * by calling `tourService.run(getXSteps(...))` inside that page's
 * `ngAfterViewInit`. All four pages are now fully anchored — no placeholder
 * ids left.
 */

/** Helper: close the current Driver.js popover and hand off to the next route. */
function goTo(tourService: TourService, router: Router, path: string): void {
  tourService.destroyCurrent();
  router.navigateByUrl(path);
}

// ---------------------------------------------------------------------------
// /applications — tour entry point
// ---------------------------------------------------------------------------
export function getApplicationsSteps(
  tourService: TourService,
  router: Router
): DriveStep[] {
  return [
    {
      element: '#tour-applications-intro',
      popover: {
        title: 'Welcome to ApplyFlow',
        description:
          "This is where every application you send ends up. Before you compile your first one, let's set up a template and a CV — click Next to head to Templates.",
        onNextClick: () => goTo(tourService, router, '/templates'),
      },
    },
  ];
}

// ---------------------------------------------------------------------------
// /templates — create a template
// ---------------------------------------------------------------------------
export function getTemplatesSteps(
  tourService: TourService,
  router: Router
): DriveStep[] {
  return [
    {
      element: '#tour-template-toggle',
      popover: {
        title: 'Create a template',
        description: 'Click here to expand the template form.',
        onNextClick: (element, _step, opts) => {
          (element as HTMLElement).click();
          setTimeout(() => opts.driver.moveNext(), 300);
        },
      },
    },
    {
      element: '#tour-template-name-field',
      popover: {
        title: 'Name it',
        description:
          'A label for you to recognize this template by later — e.g. "Follow-up Standard".',
      },
    },
    {
      element: '#tour-template-language-field',
      popover: {
        title: 'Language',
        description: 'Pick the language this template is written in.',
      },
    },
    {
      element: '#tour-template-subject-field',
      popover: {
        title: 'Subject line',
        description:
          'The email subject. Use the placeholder buttons above the field to insert dynamic values like the company name.',
      },
    },
    {
      element: '#tour-template-body-field',
      popover: {
        title: 'Body',
        description:
          'The email body. Placeholders work here too — and any skills you attach later get appended automatically if you skip {{skills_block}}.',
      },
    },
    {
      element: '#tour-template-save-btn',
      popover: {
        title: 'Save it',
        description: "Save the template, and we'll head over to CVs next.",
        onNextClick: () => goTo(tourService, router, '/cv-variants'),
      },
    },
  ];
}

// ---------------------------------------------------------------------------
// /cv-variants — add a CV
// ---------------------------------------------------------------------------
export function getCvVariantsSteps(
  tourService: TourService,
  router: Router
): DriveStep[] {
  return [
    {
      element: '#tour-cv-add-btn',
      popover: {
        title: 'Add a CV',
        description: 'Click here to register a new CV variant.',
        onNextClick: (element, _step, opts) => {
          (element as HTMLElement).click();
          // wait for the modal to open and render its fields
          setTimeout(() => opts.driver.moveNext(), 300);
        },
      },
    },
    {
      element: '#tour-cv-name-field',
      popover: {
        title: 'Name it',
        description:
          "Give this CV variant a clear name — it's used as the PDF filename when it's attached to an application.",
      },
    },
    {
      element: '#tour-cv-language-field',
      popover: {
        title: 'Language',
        description: 'Pick the language this CV is written in.',
      },
    },
    {
      element: '#tour-cv-url-field',
      popover: {
        title: 'Drive link',
        description:
          'Paste a shareable Google Drive link to the CV file. Tap the "?" next to the label if you need help finding it.',
      },
    },
    {
      element: '#tour-cv-save-btn',
      popover: {
        title: 'Save it',
        description: "Save the CV, and we'll head over to Skills next.",
        onNextClick: () => goTo(tourService, router, '/skills'),
      },
    },
  ];
}

// ---------------------------------------------------------------------------
// /skills — create a category (if needed), then a skill. Loops back to /applications.
// ---------------------------------------------------------------------------
/**
 * When there are zero categories, both "Manage" AND the dashed empty-state
 * "Add your first category" chip are visible at once — but the dashed one
 * opens the modal in a single click, so prefer it when it's there instead
 * of detouring through Manage -> New Category.
 *
 * This checks the LIVE DOM at the moment the tour actually runs, rather
 * than a `categories.length` flag computed earlier — that flag races
 * against the async categories fetch and can be stale (still 0 while data
 * is still loading), which is what broke this step before. Querying the
 * DOM directly sidesteps that: whatever's actually rendered right now is
 * definitionally correct.
 *
 * That said, the real fix belongs in skills.component.ts: don't call
 * `tourService.run(getSkillsSteps(...))` from a bare `ngAfterViewInit` —
 * call it once your categories fetch has actually resolved (e.g. inside
 * the subscribe callback, or gated on your `initialLoading` flag going
 * false), so the DOM this checks is guaranteed to reflect real data.
 */
function waitForElement(
  selector: string,
  timeout = 2000
): Promise<HTMLElement | null> {
  return new Promise((resolve) => {
    const existing = document.querySelector<HTMLElement>(selector);
    if (existing && existing.offsetParent !== null) {
      resolve(existing);
      return;
    }

    const observer = new MutationObserver(() => {
      const el = document.querySelector<HTMLElement>(selector);
      if (el && el.offsetParent !== null) {
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
      resolve(document.querySelector<HTMLElement>(selector));
    }, timeout);
  });
}

// Waits an extra couple of frames so CSS transitions/animations
// (like @sectionSlide) have a chance to finish laying out before
// driver.js snapshots the element's bounding rect.
function waitForStableLayout(el: HTMLElement): Promise<void> {
  return new Promise((resolve) => {
    let lastRect = el.getBoundingClientRect();

    const check = () => {
      const rect = el.getBoundingClientRect();
      const stable =
        rect.width === lastRect.width &&
        rect.height === lastRect.height &&
        rect.top === lastRect.top &&
        rect.left === lastRect.left;

      if (stable) {
        resolve();
        return;
      }

      lastRect = rect;
      requestAnimationFrame(check);
    };

    // give it two frames minimum before even checking
    requestAnimationFrame(() => requestAnimationFrame(check));
  });
}

async function advanceTo(
  selector: string,
  opts: { driver: any }
): Promise<void> {
  const el = await waitForElement(selector);
  if (!el) {
    opts.driver.moveNext();
    return;
  }
  await waitForStableLayout(el);
  opts.driver.moveNext();
  // some driver.js versions need an explicit refresh after moveNext
  // if the target was highlighted before final layout — harmless no-op
  // if refresh() doesn't exist on your version.
  opts.driver.refresh?.();
}
export function getSkillsSteps(
  tourService: TourService,
  router: Router
): DriveStep[] {
  const hasEmptyStateButton = !!document.querySelector(
    '#tour-category-add-first-btn'
  );

  const categorySteps: DriveStep[] = hasEmptyStateButton
    ? [
        {
          element: '#tour-category-add-first-btn',
          popover: {
            title: 'Create a category',
            description:
              'Skills are grouped by category — create your first one to get started (e.g. "Frontend", "Backend").',
            onNextClick: async (element, _step, opts) => {
              (element as HTMLElement).click();
              await advanceTo('#tour-category-name-field', opts);
            },
          },
        },
      ]
    : [
        {
          element: '#tour-category-manage-btn',
          popover: {
            title: 'Categories',
            description:
              'Skills are grouped by category. Click "Manage" to open the category panel.',
            onNextClick: async (element, _step, opts) => {
              (element as HTMLElement).click();
              await advanceTo('#tour-category-new-btn', opts);
            },
          },
        },
        {
          element: '#tour-category-new-btn',
          popover: {
            title: 'New category',
            description:
              'Already have categories? Feel free to skip ahead — or add another one here.',
            onNextClick: async (element, _step, opts) => {
              (element as HTMLElement).click();
              await advanceTo('#tour-category-name-field', opts);
            },
          },
        },
      ];

  return [
    ...categorySteps,
    {
      element: '#tour-category-name-field',
      popover: {
        title: 'Name the category',
        description: 'e.g. "Frontend", "Backend", "DevOps".',
      },
    },
    {
      element: '#tour-category-save-btn',
      popover: {
        title: 'Save the category',
        description: "Once it's saved, let's add a skill to it.",
        onNextClick: async (element, _step, opts) => {
          (element as HTMLElement).click();
          await advanceTo('#tour-skill-toggle', opts);
        },
      },
    },
    {
      element: '#tour-skill-toggle',
      popover: {
        title: 'Add a skill',
        description: 'Click here to expand the skill form.',
        onNextClick: async (element, _step, opts) => {
          (element as HTMLElement).click();
          await advanceTo('#tour-skill-name-field', opts);
        },
      },
    },
    {
      element: '#tour-skill-name-field',
      popover: {
        title: 'Skill name',
        description: 'e.g. "Next.js".',
      },
    },
    {
      element: '#tour-skill-category-field',
      popover: {
        title: 'Category',
        description: 'Assign the skill to one of your categories.',
      },
    },
    {
      element: '#tour-skill-en-field',
      popover: {
        title: 'English sentence',
        description:
          'A short line describing how you used this skill — shown on English applications.',
      },
    },
    {
      element: '#tour-skill-fr-field',
      popover: {
        title: 'French sentence',
        description: 'The same line in French — shown on French applications.',
      },
    },
    {
      element: '#tour-skill-save-btn',
      popover: {
        title: "You're all set",
        description:
          "Save this skill and you're ready to send applications. Let's head back to your applications list.",
        onNextClick: () => {
          tourService.stop();
          router.navigateByUrl('/applications');
        },
      },
    },
  ];
}