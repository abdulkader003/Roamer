import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

export type AuthFlow = 'REGISTER' | 'LOGIN' | 'PASSWORD_RESET';

export interface SignupRequest {
  email: string;
  username: string;
  password: string;
  confirmPassword: string;
}

export interface LoginRequest {
  identifier: string;
  password: string;
}

export interface VerifyEmailRequest {
  email: string;
  code: string;
  flow: AuthFlow;
}

export interface ResendCodeRequest {
  email: string;
  flow: AuthFlow;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetVerifyRequest {
  email: string;
  code: string;
}

export interface PasswordResetTokenResponse {
  message: string;
  email: string;
  resetToken: string;
  expiresInMinutes: number;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
  confirmPassword: string;
}

export interface AuthChallengeResponse {
  message: string;
  email: string;
  flow: AuthFlow;
  expiresInMinutes: number;
}

export interface AuthResponse {
  token: string;
  email: string;
  verified: boolean;
  message: string;
}

export interface MessageResponse {
  message: string;
}

type PendingChallenge = {
  email: string;
  flow: AuthFlow;
  returnUrl: string;
};

type PasswordResetState = {
  email: string;
  token: string;
};

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly apiUrl = '/api/auth';
  private readonly tokenStorageKey = 'sep.auth.token';
  private readonly emailStorageKey = 'sep.auth.email';
  private readonly pendingChallengeKey = 'sep.auth.pending-challenge';
  private readonly passwordResetStateKey = 'sep.auth.password-reset-state';

  readonly token = signal(this.readStorage(this.tokenStorageKey));
  readonly email = signal(this.readStorage(this.emailStorageKey));

  constructor(private http: HttpClient) {}

  signup(request: SignupRequest): Observable<AuthChallengeResponse> {
    return this.http.post<AuthChallengeResponse>(`${this.apiUrl}/signup`, request);
  }

  login(request: LoginRequest): Observable<AuthChallengeResponse> {
    return this.http.post<AuthChallengeResponse>(`${this.apiUrl}/login`, request);
  }

  verifyEmail(request: VerifyEmailRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/verify-email`, request).pipe(
      tap((response) => this.setSession(response))
    );
  }

  resendCode(request: ResendCodeRequest): Observable<AuthChallengeResponse> {
    return this.http.post<AuthChallengeResponse>(`${this.apiUrl}/resend-code`, request);
  }

  requestPasswordReset(request: PasswordResetRequest): Observable<AuthChallengeResponse> {
    return this.http.post<AuthChallengeResponse>(`${this.apiUrl}/forgot-password`, request);
  }

  verifyPasswordResetCode(request: PasswordResetVerifyRequest): Observable<PasswordResetTokenResponse> {
    return this.http.post<PasswordResetTokenResponse>(`${this.apiUrl}/forgot-password/verify`, request);
  }

  resetPassword(request: ResetPasswordRequest): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.apiUrl}/reset-password`, request);
  }

  setPendingChallenge(challenge: PendingChallenge): void {
    if (typeof window === 'undefined') {
      return;
    }

    window.sessionStorage.setItem(this.pendingChallengeKey, JSON.stringify(challenge));
  }

  getPendingChallenge(): PendingChallenge | null {
    if (typeof window === 'undefined') {
      return null;
    }

    const raw = window.sessionStorage.getItem(this.pendingChallengeKey);

    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<PendingChallenge>;

      if (!parsed.email || !parsed.flow) {
        return null;
      }

      return {
        email: parsed.email,
        flow: parsed.flow,
        returnUrl: parsed.returnUrl || '/dashboard'
      };
    } catch {
      return null;
    }
  }

  clearPendingChallenge(): void {
    if (typeof window === 'undefined') {
      return;
    }

    window.sessionStorage.removeItem(this.pendingChallengeKey);
  }

  setPasswordResetState(state: PasswordResetState): void {
    if (typeof window === 'undefined') {
      return;
    }

    window.sessionStorage.setItem(this.passwordResetStateKey, JSON.stringify(state));
  }

  getPasswordResetState(): PasswordResetState | null {
    if (typeof window === 'undefined') {
      return null;
    }

    const raw = window.sessionStorage.getItem(this.passwordResetStateKey);

    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<PasswordResetState>;

      if (!parsed.email || !parsed.token) {
        return null;
      }

      return {
        email: parsed.email,
        token: parsed.token
      };
    } catch {
      return null;
    }
  }

  clearPasswordResetState(): void {
    if (typeof window === 'undefined') {
      return;
    }

    window.sessionStorage.removeItem(this.passwordResetStateKey);
  }

  isAuthenticated(): boolean {
    return Boolean(this.token());
  }

  logout(): void {
    this.token.set('');
    this.email.set('');
    this.clearPendingChallenge();
    this.clearPasswordResetState();

    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.removeItem(this.tokenStorageKey);
    window.localStorage.removeItem(this.emailStorageKey);
  }

  authHeader(): Record<string, string> {
    const token = this.token();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  private setSession(response: AuthResponse): void {
    this.token.set(response.token);
    this.email.set(response.email);
    this.clearPendingChallenge();
    this.clearPasswordResetState();

    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(this.tokenStorageKey, response.token);
    window.localStorage.setItem(this.emailStorageKey, response.email);
  }

  private readStorage(key: string): string {
    if (typeof window === 'undefined') {
      return '';
    }

    return window.localStorage.getItem(key) ?? '';
  }
}
