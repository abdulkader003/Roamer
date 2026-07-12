import { ChangeDetectorRef, Component, NgZone, OnInit, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule, NgForm } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth';
import { RoamerAvatarComponent } from '../../shared/roamer-avatar/roamer-avatar.component';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [FormsModule, RouterLink, RoamerAvatarComponent],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.css'
})
export class ResetPasswordComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly zone = inject(NgZone);

  email = '';
  password = '';
  confirmPassword = '';
  message = '';
  isSubmitting = false;
  showPassword = false;
  showConfirmPassword = false;

  get avatarMood(): 'idle' | 'password-hidden' | 'password-visible' {
    return this.showPassword || this.showConfirmPassword ? 'password-visible' : 'password-hidden';
  }

  ngOnInit(): void {
    const resetState = this.authService.getPasswordResetState();

    if (!resetState?.token) {
      void this.router.navigate(['/forgot-password']);
      return;
    }

    this.email = resetState.email;
  }

  submit(form: NgForm): void {
    this.message = '';
    this.refreshView();

    if (form.invalid || !this.password || !this.confirmPassword) {
      this.message = 'Enter your new password twice to continue.';
      this.refreshView();
      return;
    }

    if (this.password.length < 8) {
      this.message = 'Password must be at least 8 characters.';
      this.refreshView();
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.message = 'Passwords do not match.';
      this.refreshView();
      return;
    }

    const resetState = this.authService.getPasswordResetState();

    if (!resetState?.token) {
      this.message = 'Your reset session expired. Start the password reset flow again.';
      this.refreshView();
      return;
    }

    this.isSubmitting = true;
    this.refreshView();

    this.authService.resetPassword({
      token: resetState.token,
      password: this.password,
      confirmPassword: this.confirmPassword
    }).subscribe({
      next: (response) => {
        this.zone.run(() => {
          this.isSubmitting = false;
          this.authService.clearPasswordResetState();
          this.refreshView();
          void this.router.navigate(['/login'], {
            queryParams: {
              message: response.message
            }
          });
        });
      },
      error: (error: unknown) => {
        this.zone.run(() => {
          this.isSubmitting = false;
          this.message = this.readErrorMessage(error);
          this.refreshView();
        });
      }
    });
  }

  togglePasswordVisibility(field: 'password' | 'confirmPassword'): void {
    if (field === 'password') {
      this.showPassword = !this.showPassword;
      return;
    }

    this.showConfirmPassword = !this.showConfirmPassword;
  }

  private refreshView(): void {
    this.cdr.detectChanges();
  }

  private readErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (typeof error.error === 'string' && error.error.trim()) {
        return error.error;
      }

      if (error.error && typeof error.error === 'object' && typeof error.error.message === 'string' && error.error.message.trim()) {
        return error.error.message;
      }
    }

    return 'Unable to reset the password right now.';
  }
}
