import { Routes } from '@angular/router';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { CalendarMonth } from './pages/calendar-month/calendar-month';
import {FlightsComponent} from './pages/flights/flights.component';
import {HotelSearchComponent} from './pages/hotels/hotel-search/hotel-search.component';
import { ActivitiesListComponent } from './pages/activities-list/activities-list';
import { ActivityDetailsComponent } from './pages/activity-details/activity-details';



export const routes: Routes = [

  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'calendar', component: CalendarMonth },
  { path: 'flights', component: FlightsComponent },
  { path: 'activities', component: ActivitiesListComponent },
  { path: 'activities/:id', component: ActivityDetailsComponent },
  { path: 'hotels', component: HotelSearchComponent},
  { path: '**', redirectTo: '' },


];
