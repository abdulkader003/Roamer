import { ChangeDetectorRef, Component, NgZone, OnInit, inject } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CalendarService } from '../hotels/services/calendar.service';
import { AuthFlow, AuthService } from '../../services/auth';
import { RoamerAvatarComponent } from '../../shared/roamer-avatar/roamer-avatar.component';

@Component({
  selector: 'app-verify-email',
  imports: [FormsModule, RouterLink, RoamerAvatarComponent],
  templateUrl: './verify-email.html',
  styleUrl: './verify-email.css'
})
export class VerifyEmail implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly calendarService = inject(CalendarService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly zone = inject(NgZone);

  email = '';
  code = '';
  message = '';
  isSuccess = false;
  isSubmitting = false;
  isResending = false;
  flow: AuthFlow = 'REGISTER';
  returnUrl = '/dashboard';

  ngOnInit(): void {
    const pendingChallenge = this.authService.getPendingChallenge();

    this.email = this.route.snapshot.queryParamMap.get('email')
      || pendingChallenge?.email
      || '';
    this.flow = (this.route.snapshot.queryParamMap.get('flow') as AuthFlow)
      || pendingChallenge?.flow
      || 'REGISTER';
    this.returnUrl = this.route.snapshot.queryParamMap.get('returnUrl')
      || pendingChallenge?.returnUrl
      || '/dashboard';
  }

  get title(): string {
    return this.flow === 'LOGIN' ? 'Enter your login code' : 'Confirm your email';
  }

  get description(): string {
    return this.flow === 'LOGIN'
      ? 'We sent a one-time sign-in code to your email. Enter it below to finish logging in.'
      : 'We sent a verification code to your email. Enter it below to activate your account.';
  }

  get submitLabel(): string {
    if (this.isSubmitting) {
      return this.flow === 'LOGIN' ? 'Signing you in...' : 'Verifying account...';
    }

    return this.flow === 'LOGIN' ? 'Complete sign in' : 'Verify and continue';
  }

  get alternateLinkLabel(): string {
    return this.flow === 'LOGIN' ? 'Back to login' : 'Back to signup';
  }

  get alternateLink(): string {
    return this.flow === 'LOGIN' ? '/login' : '/signup';
  }

  get maskedEmail(): string {
    const [localPart = '', domain = ''] = this.email.split('@');

    if (!localPart || !domain) {
      return this.email;
    }

    const visiblePrefix = localPart.slice(0, 2);
    const hidden = '*'.repeat(Math.max(2, localPart.length - visiblePrefix.length));
    return `${visiblePrefix}${hidden}@${domain}`;
  }

  submit(form: NgForm): void {
    this.message = '';
    this.isSuccess = false;
    this.refreshView();

    if (form.invalid || !this.email.trim() || !this.code.trim()) {
      this.message = 'Enter the 6-digit code sent to your email to continue.';
      this.refreshView();
      return;
    }

    this.isSubmitting = true;
    this.refreshView();

    this.authService.verifyEmail({
      email: this.email.trim(),
      code: this.code.trim(),
      flow: this.flow
    }).subscribe({
      next: async (response) => {
        this.zone.run(() => {
          this.isSubmitting = false;
          this.isSuccess = true;
          this.message = response.message || 'Verification successful.';
          this.refreshView();
        });

        try {
          await this.calendarService.completePendingEventAfterAuth();
        } catch (error) {
          console.error('Unable to complete pending calendar save after auth:', error);
        }

        void this.router.navigateByUrl(this.returnUrl || '/dashboard');
      },
      error: (error) => {
        this.zone.run(() => {
          this.isSubmitting = false;
          this.message = this.readErrorMessage(error);
          this.refreshView();
        });
      }
    });
  }

  resendCode(): void {
    this.message = '';
    this.isSuccess = false;
    this.refreshView();

    if (!this.email.trim()) {
      this.message = 'Enter your email first to request a new code.';
      this.refreshView();
      return;
    }

    this.isResending = true;
    this.refreshView();

    this.authService.resendCode({
      email: this.email.trim(),
      flow: this.flow
    }).subscribe({
      next: (response) => {
        this.zone.run(() => {
          this.isResending = false;
          this.isSuccess = true;
          this.message = response.message;
          this.authService.setPendingChallenge({
            email: response.email,
            flow: response.flow,
            returnUrl: this.returnUrl
          });
          this.refreshView();
        });
      },
      error: (error) => {
        this.zone.run(() => {
          this.isResending = false;
          this.message = this.readErrorMessage(error);
          this.refreshView();
        });
      }
    });
  }

  private refreshView(): void {
    this.cdr.detectChanges();
  }

  private readErrorMessage(error: unknown): string {
    if (typeof error === 'object' && error !== null && 'error' in error) {
      const backendError = (error as { error?: unknown }).error;

      if (typeof backendError === 'string' && backendError.trim()) {
        return backendError;
      }

      if (typeof backendError === 'object' && backendError !== null && 'message' in backendError) {
        const message = (backendError as { message?: unknown }).message;
        if (typeof message === 'string' && message.trim()) {
          return message;
        }
      }
    }

    return 'Code verification failed. Please try again.';
  }
}
