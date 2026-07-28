export interface AuthUser {
  id: string;
  userId: string;
  email: string;
  name: string;
  role: 'operator' | 'admin';
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
  expiresIn: string;
  message?: string;
}

export interface RegisterInput {
  userId: string;
  email: string;
  name: string;
  password: string;
  confirmPassword: string;
}
