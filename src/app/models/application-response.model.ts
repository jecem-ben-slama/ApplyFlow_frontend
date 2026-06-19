export interface ApplicationResponseDto {
  id: number;
  companyName: string;
  jobTitle: string;
  recipientEmail?: string;
  language: string;
  status: string;
  generatedSubject: string;
  generatedBody: string;
  dateApplied: string; // ISO LocalDateTime format string
  notes?: string;
  templateId?: number;
  cvVariantId?: number;
  userId: number;
  skillIds: number[];
}
