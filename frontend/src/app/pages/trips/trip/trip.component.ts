import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { TripBudgetResponse, TripPlanningService } from '../../../services/trip-planning.service';

@Component({
  selector: 'app-trip',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './trip.component.html',
  styleUrl: './trip.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TripComponent implements OnInit {
  private readonly tripPlanningService = inject(TripPlanningService);

  readonly trips = signal<TripBudgetResponse[]>([]);
  readonly isLoading = signal(false);
  readonly loadError = signal('');

  ngOnInit(): void {
    this.loadTrips();
  }

  loadTrips(): void {
    this.isLoading.set(true);
    this.loadError.set('');

    this.tripPlanningService.listTrips().subscribe({
      next: (trips) => {
        this.trips.set(trips);
        this.isLoading.set(false);
      },
      error: () => {
        this.loadError.set('Could not load your trips. Please try again.');
        this.isLoading.set(false);
      },
    });
  }

  formatBudget(trip: TripBudgetResponse): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: trip.currency,
      maximumFractionDigits: 0,
    }).format(trip.budget);
  }

  statusFor(index: number): string {
    return index === 0 ? 'Upcoming' : 'Planning';
  }
}
