import { TestBed } from '@angular/core/testing';
import { TripDraftService } from './trip-draft.service';

describe('TripDraftService', () => {
  let service: TripDraftService;

  beforeEach(() => {
    window.sessionStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(TripDraftService);
  });

  afterEach(() => {
    window.sessionStorage.clear();
  });

  it('returns safe defaults when no wizard draft exists', () => {
    expect(service.getDraft()).toEqual({
      tripName: '',
      budget: null,
      durationNights: 7,
      origin: '',
      destination: '',
      departureDate: '',
      returnDate: '',
      travelers: 2,
    });
  });

  it('merges updates from different wizard steps', () => {
    service.updateDraft({
      tripName: 'Summer in Barcelona',
      budget: 2000,
    });
    const updatedDraft = service.updateDraft({
      origin: 'Frankfurt',
      destination: 'Barcelona',
    });

    expect(updatedDraft.tripName).toBe('Summer in Barcelona');
    expect(updatedDraft.budget).toBe(2000);
    expect(updatedDraft.origin).toBe('Frankfurt');
    expect(updatedDraft.destination).toBe('Barcelona');
  });

  it('clears the current wizard draft', () => {
    service.updateDraft({ destination: 'Barcelona' });

    service.clearDraft();

    expect(service.getDraft().destination).toBe('');
  });
});
