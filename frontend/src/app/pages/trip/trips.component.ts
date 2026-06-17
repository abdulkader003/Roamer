import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Trip, TripService, TripStatus } from './trip.service';

@Component({
  selector: 'app-trips',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './trips.component.html',
  styleUrl: './trips.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TripsComponent implements OnInit {
  private readonly tripService = inject(TripService);

  // Signals keep OnPush rendering in sync with asynchronous API responses.
  readonly trips = signal<Trip[]>([]);
  readonly isLoading = signal(true);
  readonly errorMessage = signal('');

  ngOnInit(): void {
    this.loadTrips();
  }

  formatDateRange(trip: Trip): string {
    const start = this.parseDate(trip.startDate);
    const end = this.parseDate(trip.endDate);

    if (!start || !end) {
      return `${trip.startDate} - ${trip.endDate}`;
    }

    const startLabel = start.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
    const endLabel = start.getMonth() === end.getMonth()
      ? `${end.getDate()}, ${end.getFullYear()}`
      : end.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });

    return `${startLabel} - ${endLabel}`;
  }

  formatBudget(budget: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(budget);
  }

  statusLabel(status: TripStatus): string {
    return status === 'UPCOMING' ? 'Upcoming' : 'Planning';
  }

  private loadTrips(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    this.tripService.getTrips().subscribe({
      next: (trips) => {
        this.trips.set(trips);
        this.isLoading.set(false);
      },
      error: (error: unknown) => {
        this.errorMessage.set(this.readErrorMessage(error, 'Unable to load your trips right now.'));
        this.isLoading.set(false);
      },
    });
  }

  private parseDate(value: string): Date | null {
    // Construct in local time to avoid UTC parsing shifting the displayed day.
    const [year, month, day] = value.split('-').map(Number);

    if (!year || !month || !day) {
      return null;
    }

    return new Date(year, month - 1, day);
  }

  private readErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      if (typeof error.error === 'string' && error.error.trim()) {
        return error.error;
      }

      if (error.error && typeof error.error === 'object' && typeof error.error.message === 'string') {
        return error.error.message;
      }
    }

    return fallback;
  }
}
