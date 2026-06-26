export interface User {
  id: number;
  googleSub: string;
  email: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  pictureUrl?: string;
  refreshToken?: string;
  tokenExpiry?: string; // ISO LocalDateTime string
  createdAt: string;
  updatedAt: string;
}
