export type FieldValidator = (value: string) => string | null;

/**
 * Read a field's current value.
 */
function getFieldValue(el: Element | null): string {
  if (!el) return '';

  if (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement
  ) {
    return el.value.trim();
  }

  return (el.textContent ?? '').trim();
}

/**
 * Required-field validator, with optional length bounds.
 */
export function required(
  label: string,
  bounds?: { minLength?: number; maxLength?: number }
): FieldValidator {
  return (value) => {
    if (!value) {
      return `${label} can't be empty.`;
    }

    if (bounds?.minLength && value.length < bounds.minLength) {
      return `${label} should be at least ${bounds.minLength} characters.`;
    }

    if (bounds?.maxLength && value.length > bounds.maxLength) {
      return `${label} should be ${bounds.maxLength} characters or fewer.`;
    }

    return null;
  };
}

/**
 * Disable Driver.js "Next" while the current field is invalid,
 * showing an inline error message under the field.
 */
export function gateNextOnValid(
  fieldSelector: string,
  validate: FieldValidator
) {
  return (popover: { nextButton?: HTMLButtonElement }): void => {
    const field = document.querySelector<HTMLElement>(fieldSelector);
    const nextBtn = popover?.nextButton;

    if (!field || !nextBtn) return;

    let errorEl =
      field.parentElement?.querySelector<HTMLElement>('.tour-field-error');

    if (!errorEl) {
      errorEl = document.createElement('div');
      errorEl.className = 'tour-field-error';
      errorEl.style.color = '#dc2626';
      errorEl.style.fontSize = '12px';
      errorEl.style.marginTop = '4px';
      field.insertAdjacentElement('afterend', errorEl);
    }

    const sync = (): void => {
      const error = validate(getFieldValue(field));

      nextBtn.disabled = !!error;
      nextBtn.title = error ?? '';
      field.setAttribute('aria-invalid', String(!!error));
      errorEl!.textContent = error ?? '';
    };

    sync();

    field.addEventListener('input', sync);
    field.addEventListener('change', sync);
    field.addEventListener('blur', sync);
  };
}

/**
 * Detect Angular's built-in ng-invalid validation state on the
 * form that contains `formStillMountedSelector`.
 */
export function hasAngularValidationError(
  formStillMountedSelector: string
): boolean {
  const anchor = document.querySelector(formStillMountedSelector);
  if (!anchor) return false;

  const form = anchor.closest('form');
  if (!form) return false;

  return !!form.querySelector(
    'input.ng-invalid, textarea.ng-invalid, select.ng-invalid'
  );
}

/**
 * Required + valid-email validator, mirroring the component's own
 * `isValidEmail` regex so the tour and the real form never disagree.
 */
export function requiredEmail(label: string): FieldValidator {
  return (value) => {
    if (!value) {
      return `${label} can't be empty.`;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
      return `${label} must be a valid email address.`;
    }
    return null;
  };
}
