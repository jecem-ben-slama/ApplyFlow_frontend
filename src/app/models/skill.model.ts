export interface Skill {
  id: number;
  name: string;
  sentenceEn: string;
  sentenceFr: string;
  userId: number;
  categoryId?: number | null;
  categoryName?: string | null;
}
