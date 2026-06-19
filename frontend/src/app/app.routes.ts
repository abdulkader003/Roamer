import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { passwordResetGuard } from './guards/password-reset.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'dashboard',
    loadComponent: () => import('./pages/dashboard/dashboard.component').then((m) => m.DashboardComponent)
  },
  {
    path: 'profile',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/profile/profile.component').then((m) => m.ProfileComponent)
  },
  {
    path: 'trips',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/trip/trips.component').then((m) => m.TripsComponent)
  },
  {
    path: 'trips/create/destination',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/trip/create-trip/destination/trip-destination.component').then((m) => m.TripDestinationComponent)
  },
  {
    path: 'calendar',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/calendar-month/calendar-month').then((m) => m.CalendarMonth)
  },
  {
    path: 'trips/create/budget',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/trips/create/budget/budget.component').then((m) => m.BudgetComponent)
  },
  {
    path: 'budget-tracker',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/budget-tracker/budget-tracker').then((m) => m.BudgetTracker)
  },
  {
    path: 'flights',
    loadComponent: () => import('./pages/flights/flights.component').then((m) => m.FlightsComponent)
  },
  {
    path: 'activities',
    loadComponent: () => import('./pages/activities-list/activities-list').then((m) => m.ActivitiesListComponent)
  },
  {
    path: 'activities/:id',
    loadComponent: () => import('./pages/activity-details/activity-details').then((m) => m.ActivityDetailsComponent)
  },
  {
    path: 'hotels',
    loadComponent: () => import('./pages/hotels/hotel-search/hotel-search.component').then((m) => m.HotelSearchComponent)
  },
  {
    path: 'signup',
    loadComponent: () => import('./pages/signup/signup.component').then((m) => m.SignupComponent)
  },
  {
    path: 'verify-email',
    loadComponent: () => import('./pages/verify-email/verify-email').then((m) => m.VerifyEmail)
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login').then((m) => m.Login)
  },
  {
    path: 'forgot-password',
    loadComponent: () => import('./pages/forgot-password/forgot-password.component').then((m) => m.ForgotPasswordComponent)
  },
  {
    path: 'reset-password',
    canActivate: [passwordResetGuard],
    loadComponent: () => import('./pages/reset-password/reset-password.component').then((m) => m.ResetPasswordComponent)
  },
  { path: '**', redirectTo: '' },
];
