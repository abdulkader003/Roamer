import { Routes } from '@angular/router';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { CalendarMonth } from './pages/calendar-month/calendar-month';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'calendar', component: CalendarMonth },
  { path: '**', redirectTo: '' },
];
