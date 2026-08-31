export interface User {
  id: number;
  googleSub: string | null;
  email: string | null;
  firstName?: string;
  lastName?: string;
  name?: string;
  pictureUrl?: string;
  refreshToken?: string;
  tokenExpiry?: string; // ISO LocalDateTime string
  createdAt: string;
  updatedAt: string;
  isGuest: boolean;
}
