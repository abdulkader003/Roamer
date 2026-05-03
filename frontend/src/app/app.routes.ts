import { Routes } from '@angular/router';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import {FlightsComponent} from './pages/flights/flights.component';
export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'flights', component: FlightsComponent },
  { path: '**', redirectTo: '' },


];
