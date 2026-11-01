import type { User } from '../userModel';
import type { AuthResult, LoginInput, RegisterInput, RegistrationResult, Session } from '../types';

export interface AuthService {
  login(input: LoginInput): Promise<AuthResult>;
  register(input: RegisterInput): Promise<RegistrationResult>;
  logout(): Promise<void>;
  refreshSession(refreshToken: string): Promise<Session>;
  getCurrentUser(session: Session): Promise<User>;
  requestPasswordReset(email: string): Promise<void>;
  validateInviteCode(code: string): Promise<boolean>;
}
