import { Routes } from '@angular/router';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { ActivitiesListComponent } from './pages/activities-list/activities-list';
import { ActivityDetailsComponent } from './pages/activity-details/activity-details';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'activities', component: ActivitiesListComponent },
  { path: 'activities/:id', component: ActivityDetailsComponent },
  { path: '**', redirectTo: '' },
];
