import { Injectable } from '@angular/core';

/**
 * Shared state passed between the create-trip wizard steps.
 *
 * Each step owns only its fields and merges them into this draft, which keeps
 * teammates from coupling their pages directly to one another.
 */
export interface TripDraft {
  tripName: string;
  budget: number | null;
  durationNights: number;
  origin: string;
  destination: string;
  departureDate: string;
  returnDate: string;
  travelers: number;
}

const EMPTY_TRIP_DRAFT: TripDraft = {
  tripName: '',
  budget: null,
  durationNights: 7,
  origin: '',
  destination: '',
  departureDate: '',
  returnDate: '',
  travelers: 2,
};

@Injectable({
  providedIn: 'root',
})
export class TripDraftService {
  private readonly storageKey = 'roamer.create-trip-draft';

  getDraft(): TripDraft {
    if (typeof window === 'undefined') {
      return { ...EMPTY_TRIP_DRAFT };
    }

    const storedDraft = window.sessionStorage.getItem(this.storageKey);

    if (!storedDraft) {
      return { ...EMPTY_TRIP_DRAFT };
    }

    try {
      return {
        ...EMPTY_TRIP_DRAFT,
        ...JSON.parse(storedDraft) as Partial<TripDraft>,
      };
    } catch {
      return { ...EMPTY_TRIP_DRAFT };
    }
  }

  updateDraft(changes: Partial<TripDraft>): TripDraft {
    const nextDraft = {
      ...this.getDraft(),
      ...changes,
    };

    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(this.storageKey, JSON.stringify(nextDraft));
    }

    return nextDraft;
  }

  clearDraft(): void {
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(this.storageKey);
    }
  }
}
