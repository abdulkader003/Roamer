import { Routes } from '@angular/router';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { CalendarMonth } from './pages/calendar-month/calendar-month';
import { FlightsComponent } from './pages/flights/flights.component';
import { HotelSearchComponent } from './pages/hotels/hotel-search/hotel-search.component';
import { ActivitiesListComponent } from './pages/activities-list/activities-list';
import { ActivityDetailsComponent } from './pages/activity-details/activity-details';
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
import { OverviewStepComponent } from './pages/trips/create/overview/overview-step.component';
import { TripDestinationComponent } from './pages/trips/create/destination/trip-destination.component';
import { TripFlightsComponent } from './pages/trips/create/flights/trip-flights.component';
import { TripComponent } from './pages/trips/trip/trip.component';
import { BudgetTracker } from './pages/budget-tracker/budget-tracker';
import { ProfileComponent } from './pages/profile/profile.component';
import { SettingsComponent } from './pages/settings/settings.component';
import { TravelDealsComponent } from './pages/travel-deals/travel-deals.component';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },

  { path: 'dashboard', component: DashboardComponent },
  { path: 'profile', component: ProfileComponent, canActivate: [authGuard] },

  { path: 'calendar', component: CalendarMonth, canActivate: [authGuard] },
  { path: 'trips', component: TripComponent, canActivate: [authGuard] },
  { path: 'trips/create/budget', component: BudgetComponent, canActivate: [authGuard] },
  { path: 'trips/create/hotels', component: HotelsStepComponent, canActivate: [authGuard] },
  { path: 'trips/create/activities', component: ActivitiesStepComponent, canActivate: [authGuard] },
  { path: 'trips/create/overview', component: OverviewStepComponent, canActivate: [authGuard] },
  { path: 'trips/create/destination', component: TripDestinationComponent, canActivate: [authGuard] },
  { path: 'trips/create/flights', component: TripFlightsComponent, canActivate: [authGuard] },
  { path: 'budget-tracker', component: BudgetTracker, canActivate: [authGuard] },
  { path: 'settings', component: SettingsComponent, canActivate: [authGuard] },
  { path: 'travel-deals', component: TravelDealsComponent, canActivate: [authGuard] },

  { path: 'flights', component: FlightsComponent },
  { path: 'activities', component: ActivitiesListComponent },
  { path: 'activities/:id', component: ActivityDetailsComponent },
  { path: 'hotels', component: HotelSearchComponent },

  { path: 'signup', component: SignupComponent },
  { path: 'verify-email', component: VerifyEmail },
  { path: 'login', component: Login },
  { path: 'forgot-password', component: ForgotPasswordComponent },
  { path: 'reset-password', component: ResetPasswordComponent, canActivate: [passwordResetGuard] },

  { path: '**', redirectTo: '' },
];
