export interface ApplicationCreateDto {
  companyName: string;
  jobTitle: string;
  recipientEmail?: string;
  language: string;
  templateId?: number;
  cvVariantId?: number;
  userId: number;
  skillIds: number[]; // Set<Long> maps clean to number arrays
  notes?: string;
}
