import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { passwordResetGuard } from './guards/password-reset.guard';
import { VerifyEmail } from './pages/verify-email/verify-email';
import { Login } from './pages/login/login';
import { ForgotPasswordComponent } from './pages/forgot-password/forgot-password.component';
import { ResetPasswordComponent } from './pages/reset-password/reset-password.component';
import { SignupComponent } from './pages/signup/signup.component';
import { BudgetComponent } from './pages/trips/create/budget/budget.component';
import { HotelsStepComponent } from './pages/trips/create/hotels/hotels-step.component';
import { ActivitiesStepComponent } from './pages/trips/create/activities/activities-step.component';
import { TripDestinationComponent } from './pages/trips/create/destination/trip-destination.component';
import { TripFlightsComponent } from './pages/trips/create/flights/trip-flights.component';
import { TripComponent } from './pages/trips/trip/trip.component';
import { BudgetTracker } from './pages/budget-tracker/budget-tracker';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'dashboard',
    loadComponent: () => import('./pages/dashboard/dashboard.component').then((m) => m.DashboardComponent),
  },
  {
    path: 'profile',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/profile/profile.component').then((m) => m.ProfileComponent),
  },
  { path: 'trips', component: TripComponent, canActivate: [authGuard] },
  { path: 'trips/create/budget', component: BudgetComponent, canActivate: [authGuard] },
  { path: 'trips/create/hotels', component: HotelsStepComponent, canActivate: [authGuard] },
  { path: 'trips/create/activities', component: ActivitiesStepComponent, canActivate: [authGuard] },
  { path: 'trips/create/destination', component: TripDestinationComponent, canActivate: [authGuard] },
  { path: 'trips/create/flights', component: TripFlightsComponent, canActivate: [authGuard] },
  {
    path: 'calendar',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/calendar-month/calendar-month').then((m) => m.CalendarMonth),
  },
  { path: 'budget-tracker', component: BudgetTracker, canActivate: [authGuard] },
  {
    path: 'flights',
    loadComponent: () => import('./pages/flights/flights.component').then((m) => m.FlightsComponent),
  },
  {
    path: 'activities',
    loadComponent: () => import('./pages/activities-list/activities-list').then((m) => m.ActivitiesListComponent),
  },
  {
    path: 'activities/:id',
    loadComponent: () => import('./pages/activity-details/activity-details').then((m) => m.ActivityDetailsComponent),
  },
  {
    path: 'hotels',
    loadComponent: () => import('./pages/hotels/hotel-search/hotel-search.component').then((m) => m.HotelSearchComponent),
  },
  { path: 'signup', component: SignupComponent },
  { path: 'verify-email', component: VerifyEmail },
  { path: 'login', component: Login },
  { path: 'forgot-password', component: ForgotPasswordComponent },
  { path: 'reset-password', component: ResetPasswordComponent, canActivate: [passwordResetGuard] },
  { path: '**', redirectTo: '' },
];
