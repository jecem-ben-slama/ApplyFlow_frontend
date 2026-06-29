export interface ApplicationResponseDto {
  id: number;
  companyName: string;
  jobTitle: string;
  recipientEmail?: string;
  language: string;
  status: string;
  generatedSubject: string;
  generatedBody: string;
  dateApplied: string; 
  notes?: string;
  templateId?: number;
  cvVariantId?: number;
  userId: number;
  skillIds: number[];
}
