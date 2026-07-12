import { ChangeDetectorRef, Component, NgZone, OnInit, inject } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth';
import { RoamerAvatarComponent } from '../../shared/roamer-avatar/roamer-avatar.component';

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink, RoamerAvatarComponent],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly zone = inject(NgZone);

  identifier = '';
  password = '';
  message = '';
  isSuccess = false;
  isSubmitting = false;
  showPassword = false;
  isPasswordFocused = false;
  returnUrl = '/dashboard';

  get avatarMood(): 'idle' | 'password-hidden' | 'password-visible' {
    return this.showPassword ? 'password-visible' : 'password-hidden';
  }

  ngOnInit(): void {
    this.returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/dashboard';
    const message = this.route.snapshot.queryParamMap.get('message');

    const pendingChallenge = this.authService.getPendingChallenge();
    if (pendingChallenge?.email) {
      this.identifier = pendingChallenge.email;
    }

    if (message) {
      this.message = message;
      this.isSuccess = true;
      this.refreshView();
    }
  }

  submit(form: NgForm): void {
    this.message = '';
    this.isSuccess = false;
    this.refreshView();

    if (form.invalid || !this.identifier.trim() || !this.password) {
      this.message = 'Enter your email or username and password to continue.';
      this.refreshView();
      return;
    }

    this.isSubmitting = true;
    this.refreshView();

    this.authService.login({
      identifier: this.identifier.trim(),
      password: this.password
    }).subscribe({
      next: (response) => {
        this.zone.run(() => {
          this.isSubmitting = false;
          this.authService.setPendingChallenge({
            email: response.email,
            flow: response.flow,
            returnUrl: this.returnUrl
          });
          this.refreshView();
          void this.router.navigate(['/verify-email'], {
            queryParams: {
              email: response.email,
              flow: response.flow,
              returnUrl: this.returnUrl
            }
          });
        });
      },
      error: (error) => {
        this.zone.run(() => {
          this.isSubmitting = false;
          this.isSuccess = false;
          this.message = this.readErrorMessage(error);
          this.refreshView();
        });
      }
    });
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
    this.isPasswordFocused = true;
  }

  setPasswordFocused(isFocused: boolean): void {
    this.isPasswordFocused = isFocused;
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

    return 'Sign-in failed. Please try again.';
  }
}
