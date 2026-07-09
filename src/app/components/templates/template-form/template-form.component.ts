import {
  Component,
  Input,
  Output,
  EventEmitter,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

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
export class TemplateFormComponent {
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

  // Must match exactly what ApplicationService.createAndCompileApplication replaces.
  // {{skills_block}} is auto-appended by the backend if omitted, so it's optional —
  // the rest are recommended so the compiled output isn't missing context.
  readonly placeholders: PlaceholderToken[] = [
    {
      token: '{{position}}',
      label: 'Position',
      hint: 'Replaced with the job title',
      example: 'Software Engineer',
    },
    {
      token: '{{role}}',
      label: 'Role',
      hint: 'Same as Position — an alias for the job title',
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

  @ViewChild('subjectInput') subjectInputRef?: ElementRef<HTMLInputElement>;
  @ViewChild('bodyInput') bodyInputRef?: ElementRef<HTMLTextAreaElement>;

  private readonly knownTokens = this.placeholders.map((p) => p.token);
  private readonly placeholderPattern = /\{\{\s*[\w]+\s*\}\}/g;

  togglePlaceholderInfo(): void {
    this.showPlaceholderInfo = !this.showPlaceholderInfo;
  }

  onSubmit(form: NgForm): void {
    Object.values(form.controls).forEach((control) => control.markAsTouched());
    if (form.invalid || this.loading) {
      return;
    }
    this.formSubmit.emit(this.templateData);
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
}
