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
  resolvedTemplateBody: string | null = null;
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

  /** Renders the actual template body fetched from the backend, including the CV name and skills block. */
  get previewBody(): string {
    if (!this.resolvedTemplateBody) {
      return 'Loading template content...';
    }

    const company = '[Company Name]';
    const role = this.preset.jobTitle || '[Job Title]';
    const cvName = this.resolvedCvVariantName || '[CV Variant]';

    const skillsContent = this.resolvedSkillSentences
      .filter((s) => !!s)
      .map((s) => `• ${s}`)
      .join('\n');

    let body = this.resolvedTemplateBody
      .replace(/\{\{companyname\}\}/gi, company)
      .replace(/\{\{company\}\}/gi, company)
      .replace(/\{\{position\}\}/gi, role)
      .replace(/\{\{role\}\}/gi, role)
      .replace(/\{\{jobtitle\}\}/gi, role)
      .replace(/\{\{job_title\}\}/gi, role)
      .replace(/\{\{cv\}\}/gi, cvName)
      .replace(/\{\{cv_variant\}\}/gi, cvName)
      .replace(/\{\{language\}\}/gi, this.preset.language ?? '')
      .replace(/\{\{notes\}\}/gi, this.preset.notes ?? '')
      .replace(
        /\{\{(skills_block|skills|skillbullets|skill_bullets)\}\}/gi,
        skillsContent
      );

    // If the template doesn't explicitly contain a CV placeholder, append it cleanly at the bottom
    if (
      this.resolvedCvVariantName &&
      !body.includes(this.resolvedCvVariantName)
    ) {
      body += `\n\nAttached CV: ${this.resolvedCvVariantName}`;
    }

    return body;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.isSending) {
      this.confirmingSend = false;
    }

    if (!changes['preset']) return;

    this.resolvedTemplateName = null;
    this.resolvedTemplateBody = null;
    this.resolvedCvVariantName = null;
    this.resolvedSkillSentences = [];
    clearTimeout(this.confirmTimeout);

    if (this.preset?.templateId) this.fetchTemplate();
    if (this.preset?.cvVariantId) this.fetchCvVariantName();
    if (this.preset?.skillIds?.length) this.fetchSkillNames();
  }

  private fetchTemplate(): void {
    this.isLoadingTemplate = true;
    this.templateService.getTemplateById(this.preset.templateId).subscribe({
      next: (template) => {
        this.resolvedTemplateName =
          template.name ?? `Template #${this.preset.templateId}`;
        this.resolvedTemplateBody = template.bodyTemplate ?? '';
        this.isLoadingTemplate = false;
      },
      error: () => {
        this.resolvedTemplateName = `Template #${this.preset.templateId}`;
        this.resolvedTemplateBody = 'Failed to load template body.';
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
