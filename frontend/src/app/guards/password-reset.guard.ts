import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth';

export const passwordResetGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.getPasswordResetState()?.token) {
    return true;
  }

  return router.createUrlTree(['/forgot-password']);
};
