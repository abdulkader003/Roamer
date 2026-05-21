import { ChangeDetectorRef, Component, NgZone, OnInit, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule, NgForm } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.css'
})
export class ForgotPasswordComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly zone = inject(NgZone);

  email = '';
  code = '';
  message = '';
  isSuccess = false;
  isSubmitting = false;
  hasRequestedCode = false;

  ngOnInit(): void {
    const resetState = this.authService.getPasswordResetState();

    if (resetState?.email) {
      this.email = resetState.email;
    }
  }

  submit(form: NgForm): void {
    if (this.hasRequestedCode) {
      this.verifyCode(form);
      return;
    }

    this.requestCode(form);
  }

  requestCode(form?: NgForm): void {
    this.message = '';
    this.isSuccess = false;
    this.refreshView();

    if (!this.email.trim() || form?.controls['email']?.invalid) {
      this.message = 'Enter the email address for your account.';
      this.refreshView();
      return;
    }

    this.isSubmitting = true;
    this.refreshView();

    this.authService.requestPasswordReset({
      email: this.email.trim().toLowerCase()
    }).subscribe({
      next: (response) => {
        this.zone.run(() => {
          this.isSubmitting = false;
          this.email = response.email;
          this.hasRequestedCode = true;
          this.isSuccess = true;
          this.message = response.message;
          this.refreshView();
        });
      },
      error: (error: unknown) => {
        this.zone.run(() => {
          this.isSubmitting = false;
          this.isSuccess = false;
          this.message = this.readErrorMessage(error, 'Unable to send a reset code right now.');
          this.refreshView();
        });
      }
    });
  }

  verifyCode(form: NgForm): void {
    this.message = '';
    this.isSuccess = false;
    this.refreshView();

    if (!this.email.trim() || form.controls['email']?.invalid) {
      this.message = 'Enter the email address for your account.';
      this.refreshView();
      return;
    }

    if (!this.code.trim()) {
      this.message = 'Enter the verification code sent to your email.';
      this.refreshView();
      return;
    }

    this.isSubmitting = true;
    this.refreshView();

    this.authService.verifyPasswordResetCode({
      email: this.email.trim().toLowerCase(),
      code: this.code.trim()
    }).subscribe({
      next: (response) => {
        this.zone.run(() => {
          this.isSubmitting = false;
          this.authService.setPasswordResetState({
            email: response.email,
            token: response.resetToken
          });
          this.refreshView();
          void this.router.navigate(['/reset-password']);
        });
      },
      error: (error: unknown) => {
        this.zone.run(() => {
          this.isSubmitting = false;
          this.isSuccess = false;
          this.message = this.readErrorMessage(error, 'Unable to verify the reset code.');
          this.refreshView();
        });
      }
    });
  }

  private refreshView(): void {
    this.cdr.detectChanges();
  }

  private readErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      if (typeof error.error === 'string' && error.error.trim()) {
        return error.error;
      }

      if (error.error && typeof error.error === 'object' && typeof error.error.message === 'string' && error.error.message.trim()) {
        return error.error.message;
      }
    }

    return fallback;
  }
}
