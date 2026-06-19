export interface User {
  id: number;
  googleSub: string;
  email: string;
  refreshToken?: string;
  tokenExpiry?: string; // ISO LocalDateTime string
  createdAt: string;
  updatedAt: string;
}
