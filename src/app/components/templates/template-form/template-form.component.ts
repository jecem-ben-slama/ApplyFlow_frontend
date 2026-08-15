import {
  Component,
  Input,
  Output,
  EventEmitter,
  ViewChild,
  ElementRef,
  OnInit,
  OnDestroy,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Subject, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { ToastService } from '../../common/toast/toast.service';

export interface TemplateData {
  name: string;
  language: string;
  subjectTemplate: string;
  bodyTemplate: string;
}

interface PlaceholderToken {
  token: string;
  label: string;
  hint: string;
  example: string;
}

@Component({
  selector: 'app-template-form',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './template-form.component.html',
})
export class TemplateFormComponent implements OnInit, OnDestroy, OnChanges {
  constructor(private toastService: ToastService) {}

  @Input() isFormVisible = false;
  @Input() isEditing = false;
  @Input() loading = false;
  @Input() errorMessage = '';
  @Input() templateData: TemplateData = {
    name: '',
    language: 'EN',
    subjectTemplate: '',
    bodyTemplate: '',
  };
  @Input() subjectPlaceholder = '';

  readonly nameMaxLength = 80;
  readonly subjectMaxLength = 150;
  readonly bodyMaxLength = 5000;
  readonly bodyMinLength = 10;
  readonly placeholders: PlaceholderToken[] = [
    {
      token: '{{position}}',
      label: 'Position',
      hint: 'Replaced with the job title',
      example: 'Software Engineer',
    },
    {
      token: '{{company}}',
      label: 'Company',
      hint: 'Replaced with the company name',
      example: 'Acme Corp',
    },
    {
      token: '{{skills_block}}',
      label: 'Skills Block',
      hint: 'Replaced with a bulleted list of the skills you select when creating the application. If omitted, it is added automatically at the end.',
      example:
        '• Java : Built scalable backend services\n• React : Developed responsive UIs',
    },
  ];

  showPlaceholderInfo = false;

  @Output() toggle = new EventEmitter<void>();
  @Output() formSubmit = new EventEmitter<TemplateData>();
  @Output() cancel = new EventEmitter<void>();
  @Output() draftSave = new EventEmitter<TemplateData>();

  @ViewChild('subjectInput') subjectInputRef?: ElementRef<HTMLInputElement>;
  @ViewChild('bodyInput') bodyInputRef?: ElementRef<HTMLTextAreaElement>;

  private readonly knownTokens = this.placeholders.map((p) => p.token);
  private readonly placeholderPattern = /\{\{\s*[\w]+\s*\}\}/g;

  /** localStorage key used to persist an unsaved draft across reloads/tab switches. */
  private readonly draftStorageKey = 'templateForm.draft';

  private draftTrigger = new Subject<void>();
  private draftSub?: Subscription;

  /** Set when a draft was silently restored into templateData — the toast fires the next time the form is actually opened (and not in edit mode), not immediately on load. */
  private draftPendingToast = false;

  ngOnInit(): void {
    // Restore any unsaved draft as soon as the component is created, so it's
    // ready the moment the user opens the form. This is a silent restore —
    // no toast yet, since the form isn't necessarily visible at this point
    // (isFormVisible is parent-controlled and defaults to false).
    if (!this.isEditing) {
      this.restoreDraft();
    }

    // Covers the edge case where the parent starts the form already expanded
    // (isFormVisible = true from the very first render) — ngOnChanges' first
    // call fires before this restore happens, so we check here too.
    if (this.isFormVisible) {
      this.notifyDraftRestoredIfPending();
    }

    this.draftSub = this.draftTrigger.pipe(debounceTime(600)).subscribe(() => {
      if (!this.isEditing) {
        this.persistDraft();
        this.draftSave.emit({ ...this.templateData });
      }
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    const visibilityChange = changes['isFormVisible'];
    const openedNow =
      visibilityChange &&
      !visibilityChange.firstChange &&
      !visibilityChange.previousValue &&
      visibilityChange.currentValue;

    if (openedNow) {
      // The component instance is reused across "new" and "edit" flows (via
      // @Input bindings), so ngOnInit only ever fires once, at creation.
      // Re-attempt a draft restore every time the form is (re)opened for a
      // *new* template — e.g. open new -> switch to edit -> cancel -> open
      // new again, where templateData has since been reset to empty by the
      // parent — otherwise the draft would only reappear after a full page
      // refresh (which is the only thing that re-runs ngOnInit).
      if (!this.isEditing) {
        this.restoreDraft();
      }

      // Parent just opened the form (false -> true) — this is the moment to
      // surface the "draft restored" toast, not at component creation time.
      this.notifyDraftRestoredIfPending();
    }
  }

  ngOnDestroy(): void {
    this.draftSub?.unsubscribe();
  }

  notifyDraft(): void {
    this.draftTrigger.next();
  }

  togglePlaceholderInfo(): void {
    this.showPlaceholderInfo = !this.showPlaceholderInfo;
  }

  onSubmit(form: NgForm): void {
    Object.values(form.controls).forEach((control) => control.markAsTouched());
    if (form.invalid || this.loading) {
      return;
    }
    this.isFormVisible = false;

    // Only clear the draft when this was actually a *new* template — saving
    // an edit to an existing template has no relationship to the pending
    // new-template draft, so it must never wipe it out.
    if (!this.isEditing) {
      this.clearDraft();
    }
    this.formSubmit.emit(this.templateData);
  }

  /** Wraps the cancel output so the persisted draft is cleared on explicit discard — but only when cancelling a *new* template, not an edit. */
  onCancel(): void {
    if (!this.isEditing) {
      this.clearDraft();
    }
    this.cancel.emit();
  }

  insertToken(field: 'subject' | 'body', token: string): void {
    if (this.loading) return;

    const el =
      field === 'subject'
        ? this.subjectInputRef?.nativeElement
        : this.bodyInputRef?.nativeElement;
    const currentValue =
      field === 'subject'
        ? this.templateData.subjectTemplate ?? ''
        : this.templateData.bodyTemplate ?? '';

    const start = el?.selectionStart ?? currentValue.length;
    const end = el?.selectionEnd ?? currentValue.length;
    const newValue =
      currentValue.slice(0, start) + token + currentValue.slice(end);

    if (field === 'subject') {
      this.templateData.subjectTemplate = newValue;
    } else {
      this.templateData.bodyTemplate = newValue;
    }

    this.notifyDraft();

    const newCursorPos = start + token.length;
    setTimeout(() => {
      el?.focus();
      el?.setSelectionRange(newCursorPos, newCursorPos);
    });
  }

  /** Placeholders present in the text that aren't among the backend's known tokens — likely typos. */
  getUnknownPlaceholders(text: string | undefined | null): string[] {
    if (!text) return [];
    const found = text.match(this.placeholderPattern) ?? [];
    const unknown = found.filter(
      (t) => !this.knownTokens.includes(t.replace(/\s+/g, ''))
    );
    return Array.from(new Set(unknown));
  }

  // ---------------------------------------------------------------------
  // Draft persistence (localStorage)
  // ---------------------------------------------------------------------

  private persistDraft(): void {
    try {
      localStorage.setItem(
        this.draftStorageKey,
        JSON.stringify(this.templateData)
      );
    } catch {
      // localStorage unavailable (private browsing, quota, etc.) — fail silently
    }
  }

  private restoreDraft(): void {
    try {
      const raw = localStorage.getItem(this.draftStorageKey);
      if (!raw) return;

      const draft: Partial<TemplateData> = JSON.parse(raw);
      const formIsEmpty =
        !this.templateData.name &&
        !this.templateData.subjectTemplate &&
        !this.templateData.bodyTemplate;

      // Only restore into an empty form so we never clobber data the parent passed in
      if (formIsEmpty) {
        this.templateData = { ...this.templateData, ...draft };
        this.draftPendingToast = true;
      }
    } catch {
      // Corrupted draft — ignore and start fresh
    }
  }

  /** Shows the "draft restored" toast, but only the first time the form is actually opened after a silent restore, and never while editing an existing template. */
  private notifyDraftRestoredIfPending(): void {
    if (this.draftPendingToast && !this.isEditing) {
      this.draftPendingToast = false;
      this.toastService.info('Unsaved draft restored.');
    }
  }

  private clearDraft(): void {
    try {
      localStorage.removeItem(this.draftStorageKey);
    } catch {}
  }
}
