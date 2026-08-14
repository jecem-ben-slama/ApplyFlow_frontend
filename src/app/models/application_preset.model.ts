
export interface ApplicationPresetDto {
  id: number;
  name: string;
  jobTitle: string;
  language: string;
  templateId: number;
  cvVariantId?: number;
  skillIds: number[];
  notes?: string;
}

export interface ApplicationPresetCreateDto {
  name: string;
  jobTitle: string | null;
  language: string;
  templateId: number | null;
  cvVariantId?: number | null;
  skillIds: number[];
  notes?: string | null;
}
