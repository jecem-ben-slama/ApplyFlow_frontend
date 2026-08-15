import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApplicationResponseDto } from '../../../models';
import { CvVariantsService } from 'src/app/services/cv-variants.service';

@Component({
  selector: '[app-application-row]',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './application-row.component.html',
})
export class ApplicationRowComponent {
  @Input() app!: ApplicationResponseDto;
  @Input() isExpanded = false;
  @Input() isSendingEmail = false;
  @Input() isSelected = false;
  /** True while a status update for this row is in flight (optimistic-update spinner). */
  @Input() isStatusPending = false;

  @Output() togglePanel = new EventEmitter<number>();
  @Output() statusChange = new EventEmitter<{ id: number; status: string }>();
  @Output() deleteApp = new EventEmitter<number>();
  @Output() sendEmail = new EventEmitter<ApplicationResponseDto>();
  @Output() copyBody = new EventEmitter<string>();
  @Output() notesSaved = new EventEmitter<{ appId: number; notes: string }>();
  @Output() selectToggle = new EventEmitter<number>();

  private cvVariantService = inject(CvVariantsService);

  resolvedVariantName: string | null = null;
  isLoadingVariant = false;

  fetchVariantName(): void {
    if (
      this.resolvedVariantName ||
      this.isLoadingVariant ||
      !this.app.cvVariantId
    ) {
      return;
    }

    this.isLoadingVariant = true;

    this.cvVariantService.getCvVariantById(this.app.cvVariantId).subscribe({
      next: (variant) => {
        // Change 'variant.name' to whatever property holds the name in your CvVariantDto (e.g. variant.title, variant.fileName)
        this.resolvedVariantName =
          variant.name ?? 'CV Variant #' + this.app.cvVariantId;
        this.isLoadingVariant = false;
      },
      error: () => {
        this.resolvedVariantName = 'CV Variant #' + this.app.cvVariantId;
        this.isLoadingVariant = false;
      },
    });
  }

  /**
   * A COMPILED row hasn't been sent yet, so its status is entirely
   * backend-driven up to that point — the dropdown is locked until the
   * user actually sends it (which is what transitions it out of COMPILED
   * on the backend).
   */
  get isStatusLocked(): boolean {
    return this.app.status === 'COMPILED';
  }

  get statusLockedTitle(): string {
    return this.isStatusLocked
      ? 'Status is locked until this application is sent'
      : '';
  }

  private readonly statusClassMap: Record<string, string> = {
    // Neutral / Initial states
    COMPILED:
      'bg-gray-100 dark:bg-gray-800/60 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600',
    SENT: 'bg-cyan-100 dark:bg-cyan-950/50 text-white-700 dark:text-white-300 border-cyan-300 dark:border-cyan-800',
    VIEWED:
      'bg-violet-50 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300 border-violet-300 dark:border-violet-800',

    // Positive progress / Response / Interview states
    RESPONDED:
      'bg-lime-50 dark:bg-lime-950/50 text-lime-700 dark:text-lime-300 border-lime-300 dark:border-lime-800',
    INTERVIEW_SCHEDULED:
      'bg-orange-50 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-800',
    INTERVIEWING:
      'bg-yellow-50 dark:bg-yellow-950/50 text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-800',
    OFFER:
      'bg-green-50 dark:bg-green-950/50 text-green-700 dark:text-green-300 border-green-300 dark:border-green-800',

    // Terminal / Negative states
    REJECTED:
      'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border-red-300 dark:border-red-800',
    GHOSTED:
      'bg-neutral-100 dark:bg-neutral-800/50 text-neutral-600 dark:text-neutral-400 border-neutral-300 dark:border-neutral-600',
    WITHDRAWN:
      'bg-fuchsia-50 dark:bg-fuchsia-950/50 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-300 dark:border-fuchsia-800',
  };

  getStatusClasses(status: string): string {
    return this.statusClassMap[status] ?? this.statusClassMap['COMPILED'];
  }
}
