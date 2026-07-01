import { ChangeDetectorRef, Component, NgZone, inject } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth';
import { RoamerAvatarComponent } from '../../shared/roamer-avatar/roamer-avatar.component';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [FormsModule, RouterLink, RoamerAvatarComponent],
  templateUrl: './signup.component.html',
  styleUrl: './signup.component.scss'
})
export class SignupComponent {
  private readonly usernamePattern = /^[A-Za-z0-9_.-]+$/;
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly zone = inject(NgZone);

  email = '';
  username = '';
  password = '';
  confirmPassword = '';
  errorMessage = '';
  successMessage = '';
  isSubmitting = false;
  returnUrl = '/dashboard';

  ngOnInit(): void {
    this.returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/dashboard';
  }

  onSignup(form: NgForm) {
    this.errorMessage = '';
    this.successMessage = '';
    this.refreshView();

    if (form.invalid || !this.email.trim() || !this.username.trim() || !this.password || !this.confirmPassword) {
      this.errorMessage = 'Please complete all signup fields.';
      this.refreshView();
      return;
    }

    if (!this.email.includes('@')) {
      this.errorMessage = 'Enter a valid email address.';
      this.refreshView();
      return;
    }

    if (this.username.trim().length < 3 || this.username.trim().length > 30) {
      this.errorMessage = 'Username must be between 3 and 30 characters.';
      this.refreshView();
      return;
    }

    if (!this.usernamePattern.test(this.username.trim())) {
      this.errorMessage = 'Username may only contain letters, numbers, dots, hyphens, and underscores.';
      this.refreshView();
      return;
    }

    if (this.password.length < 8) {
      this.errorMessage = 'Password must be at least 8 characters.';
      this.refreshView();
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.errorMessage = 'Passwords do not match.';
      this.refreshView();
      return;
    }

    this.isSubmitting = true;
    this.refreshView();

    this.authService.signup({
      email: this.email.trim().toLowerCase(),
      username: this.username.trim().toLowerCase(),
      password: this.password,
      confirmPassword: this.confirmPassword
    }).subscribe({
      next: (response) => {
        this.zone.run(() => {
          this.isSubmitting = false;
          this.successMessage = response.message || 'Account created successfully.';
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
      error: (err: unknown) => {
        this.zone.run(() => {
          this.isSubmitting = false;
          this.errorMessage = this.readErrorMessage(err);
          this.refreshView();
        });
      }
    });
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

      if (error.status === 400) {
        return 'Signup data was rejected. Check your email, username, and password, then try again.';
      }

      if (error.status === 500) {
        return 'The server could not create the account right now. Check the backend logs and try again.';
      }
    }

    return 'Something went wrong. Please try again.';
  }
}
