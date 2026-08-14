import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
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

  resolvedSkillNames: string[] = [];
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
    const lines: string[] = [`Dear Hiring Manager,`, ``];

    lines.push(
      `I'm applying for ${role}.  ${(
        this.preset.language || 'EN'
      ).toUpperCase()}` +
        (this.resolvedTemplateName
          ? `, using the "${this.resolvedTemplateName}" template.`
          : `.`)
    );

    if (this.resolvedCvVariantName) {
      lines.push(``, `Attached CV: ${this.resolvedCvVariantName}.`);
    }

    if (this.resolvedSkillNames.length) {
      lines.push(
        ``,
        `Key skills highlighted: ${this.resolvedSkillNames.join(', ')}.`
      );
    }

    lines.push(``, `Looking forward to hearing from you.`, ``, `Best regards,`);

    return lines.join('\n');
  }

  ngOnChanges(): void {
    this.resolvedTemplateName = null;
    this.resolvedCvVariantName = null;
    this.resolvedSkillNames = [];
    if (!this.isSending) {
      this.confirmingSend = false;
    }
    clearTimeout(this.confirmTimeout);

    if (this.preset?.templateId) this.fetchTemplateName();
    if (this.preset?.cvVariantId) this.fetchCvVariantName();
    if (this.preset?.skillIds?.length) this.fetchSkillNames();
  }

  private fetchTemplateName(): void {
    this.isLoadingTemplate = true;
    this.templateService.getTemplateById(this.preset.templateId).subscribe({
      next: (template) => {
        this.resolvedTemplateName =
          template.bodyTemplate ?? `Template #${this.preset.templateId}`;
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

  private fetchSkillNames(): void {
    this.isLoadingSkills = true;
    forkJoin(
      this.preset.skillIds.map((id) => this.skillsService.getSkillById(id))
    ).subscribe({
      next: (skills) => {
        this.resolvedSkillNames = skills.map(
          (s, i) => s.name ?? `Skill #${this.preset.skillIds[i]}`
        );
        this.isLoadingSkills = false;
      },
      error: () => {
        this.resolvedSkillNames = this.preset.skillIds.map(
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
