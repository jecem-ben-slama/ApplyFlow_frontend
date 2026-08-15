import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin } from 'rxjs';

import { ApplicationPresetDto } from 'src/app/models/application_preset.model';
import { TemplateService } from '../../../services/template.service';
import { CvVariantsService } from 'src/app/services/cv-variants.service';
import { SkillsService } from '../../../services/skills.service';
import { PresetNotesPanelComponent } from '../preset-notes-panel/preset-notes-panel.component';

@Component({
  selector: 'app-preset-details-panel',
  standalone: true,
  imports: [CommonModule, PresetNotesPanelComponent],
  templateUrl: './preset-details-panel.component.html',
})
export class PresetDetailsPanelComponent implements OnChanges {
  @Input() preset!: ApplicationPresetDto;
  @Input() isSending = false;
  @Input() sendError = '';

  @Output() send = new EventEmitter<ApplicationPresetDto>();
  @Output() deletePreset = new EventEmitter<ApplicationPresetDto>();
  @Output() copyBody = new EventEmitter<string>();
  @Output() notesSaved = new EventEmitter<{
    presetId: number;
    notes: string;
  }>();

  private templateService = inject(TemplateService);
  private cvVariantsService = inject(CvVariantsService);
  private skillsService = inject(SkillsService);

  resolvedTemplateName: string | null = null;
  isLoadingTemplate = false;

  resolvedCvVariantName: string | null = null;
  isLoadingCvVariant = false;

  resolvedSkillSentences: string[] = [];
  isLoadingSkills = false;

  copied = false;
  confirmingSend = false;
  private confirmTimeout?: ReturnType<typeof setTimeout>;

  get isLoadingAny(): boolean {
    return (
      this.isLoadingTemplate || this.isLoadingCvVariant || this.isLoadingSkills
    );
  }

  /** Composes the resolved preset data into a flowing, email-shaped preview. */
  get previewBody(): string {
    const role = this.preset.jobTitle || 'this role';
    const language = (this.preset.language || 'EN').toUpperCase();
    const lines: string[] = [`Dear Hiring Manager,`, ``];

    lines.push(
      `I'm applying for ${role} (${language})` +
        (this.resolvedTemplateName
          ? `, using the "${this.resolvedTemplateName}" template.`
          : `.`)
    );

    if (this.resolvedCvVariantName) {
      lines.push(``, `Attached CV: ${this.resolvedCvVariantName}.`);
    }

    if (this.resolvedSkillSentences.length) {
      lines.push(
        ``,
        `Key skills highlighted: ${this.resolvedSkillSentences.join(', ')}.`
      );
    }

    lines.push(``, `Looking forward to hearing from you.`, ``, `Best regards,`);

    return lines.join('\n');
  }

  ngOnChanges(changes: SimpleChanges): void {
    // isSending/sendError also flow through here (they're @Input()s too), so
    // this must only reset/re-fetch when the preset itself actually changed —
    // otherwise every send-in-progress tick wipes the preview back to
    // "Building preview…" and re-hits all three services for no reason.
    if (!this.isSending) {
      this.confirmingSend = false;
    }

    if (!changes['preset']) return;

    this.resolvedTemplateName = null;
    this.resolvedCvVariantName = null;
    this.resolvedSkillSentences = [];
    clearTimeout(this.confirmTimeout);

    if (this.preset?.templateId) this.fetchTemplateName();
    if (this.preset?.cvVariantId) this.fetchCvVariantName();
    if (this.preset?.skillIds?.length) this.fetchSkillNames();
  }

  private fetchTemplateName(): void {
    this.isLoadingTemplate = true;
    this.templateService.getTemplateById(this.preset.templateId).subscribe({
      next: (template) => {
        // Was reading `template.bodyTemplate` — the full email body, not a
        // short label — which flooded the avatar row and the "using the ..."
        // sentence with the entire template text instead of its name.
        this.resolvedTemplateName =
          template.name ?? `Template #${this.preset.templateId}`;
        this.isLoadingTemplate = false;
      },
      error: () => {
        this.resolvedTemplateName = `Template #${this.preset.templateId}`;
        this.isLoadingTemplate = false;
      },
    });
  }

  private fetchCvVariantName(): void {
    this.isLoadingCvVariant = true;
    this.cvVariantsService
      .getCvVariantById(this.preset.cvVariantId!)
      .subscribe({
        next: (variant) => {
          this.resolvedCvVariantName =
            variant.name ?? `CV Variant #${this.preset.cvVariantId}`;
          this.isLoadingCvVariant = false;
        },
        error: () => {
          this.resolvedCvVariantName = `CV Variant #${this.preset.cvVariantId}`;
          this.isLoadingCvVariant = false;
        },
      });
  }

  /**
   * Resolves each skill's full sentence in the preset's language (French if
   * `preset.language` is French, English otherwise), falling back to the
   * other language's sentence. Skills with neither sentence set are dropped
   * rather than falling back to a bare name — same rule as the application
   * popup's `getSkillSentence`/`buildSkillBullets`.
   */
  private fetchSkillNames(): void {
    this.isLoadingSkills = true;
    forkJoin(
      this.preset.skillIds.map((id) => this.skillsService.getSkillById(id))
    ).subscribe({
      next: (skills) => {
        const isFrench = (this.preset.language || '')
          .trim()
          .toLowerCase()
          .startsWith('fr');

        this.resolvedSkillSentences = skills
          .map((s) => {
            const preferred = isFrench ? s.sentenceFr : s.sentenceEn;
            const fallback = isFrench ? s.sentenceEn : s.sentenceFr;
            return preferred?.trim() || fallback?.trim() || '';
          })
          .filter((sentence) => !!sentence);
        this.isLoadingSkills = false;
      },
      error: () => {
        this.resolvedSkillSentences = this.preset.skillIds.map(
          (id) => `Skill #${id}`
        );
        this.isLoadingSkills = false;
      },
    });
  }

  onDeleteClick(): void {
    this.deletePreset.emit(this.preset);
  }

  onSendClick(): void {
    if (this.isSending) return;

    if (!this.confirmingSend) {
      this.confirmingSend = true;
      clearTimeout(this.confirmTimeout);
      this.confirmTimeout = setTimeout(
        () => (this.confirmingSend = false),
        3000
      );
      return;
    }

    clearTimeout(this.confirmTimeout);
    this.confirmingSend = false;
    this.send.emit(this.preset);
  }

  onCopyClick(): void {
    this.copyBody.emit(this.previewBody);
    this.copied = true;
    setTimeout(() => (this.copied = false), 2000);
  }
}
