import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ApplicationCreateDto,
  Skill,
  CvVariantDto,
  TemplateDto,
} from '../../../models';

@Component({
  selector: 'app-application-popup',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './application-popup.component.html',
})
export class ApplicationPopupComponent implements OnInit {
  @Input() availableSkills: Skill[] = [];
  @Input() availableCvVariants: CvVariantDto[] = [];
  @Input() availableTemplates: TemplateDto[] = [];
  @Input() isLoading = false;

  @Output() close = new EventEmitter<void>();
  @Output() submit = new EventEmitter<ApplicationCreateDto>();

  formModel: ApplicationCreateDto = {
    companyName: '',
    jobTitle: '',
    recipientEmail: '',
    language: 'en',
    templateId: undefined,
    cvVariantId: undefined,
    userId: 0,
    skillIds: [],
    notes: '',
  };

  selectedTemplatePreview?: TemplateDto;

  ngOnInit(): void {}

  closeModal(): void {
    this.close.emit();
  }

  onTemplateChange(): void {
    if (!this.formModel.templateId) {
      this.selectedTemplatePreview = undefined;
      return;
    }
    this.selectedTemplatePreview = this.availableTemplates.find(
      (t) => t.id === Number(this.formModel.templateId)
    );
  }

  hasPlaceholder(tagFragment: string): boolean {
    if (!this.selectedTemplatePreview?.bodyTemplate) return false;
    return this.selectedTemplatePreview.bodyTemplate
      .toLowerCase()
      .includes(tagFragment.toLowerCase());
  }

  getLiveTemplateBodyPreview(): string {
    if (!this.selectedTemplatePreview?.bodyTemplate) return '';

    let rawBody = this.selectedTemplatePreview.bodyTemplate;
    const companyReplacer =
      this.formModel.companyName || '[Company Destination]';
    const positionReplacer = this.formModel.jobTitle || '[Target Job Title]';

    return rawBody
      .replace(/\{\{companyname\}\}/gi, companyReplacer)
      .replace(/\{\{company\}\}/gi, companyReplacer)
      .replace(/\{\{position\}\}/gi, positionReplacer)
      .replace(/\{\{role\}\}/gi, positionReplacer);
  }

  toggleSkillSelection(skillId: number): void {
    const index = this.formModel.skillIds.indexOf(skillId);
    if (index > -1) {
      this.formModel.skillIds.splice(index, 1);
    } else {
      this.formModel.skillIds.push(skillId);
    }
  }

  onSubmit(): void {
    if (!this.formModel.templateId) {
      alert('Please select a base template configuration layout.');
      return;
    }

    const activeTemplate = this.availableTemplates.find(
      (t) => t.id === Number(this.formModel.templateId)
    );

    if (activeTemplate) {
      activeTemplate.bodyTemplate = activeTemplate.bodyTemplate.replace(
        /\{\{companyname\}\}/gi,
        '{{company}}'
      );
      activeTemplate.subjectTemplate = activeTemplate.subjectTemplate.replace(
        /\{\{companyname\}\}/gi,
        '{{company}}'
      );
    }

    const payload: ApplicationCreateDto = {
      ...this.formModel,
      templateId: Number(this.formModel.templateId),
      cvVariantId: this.formModel.cvVariantId
        ? Number(this.formModel.cvVariantId)
        : undefined,
    };

    this.submit.emit(payload);
  }
}
