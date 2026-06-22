import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Subject, throwError } from 'rxjs';

import { TripBudgetResponse, TripPlanningService } from '../../../../services/trip-planning.service';
import { TripTempService } from '../trip-temp.service';
import { BudgetComponent } from './budget.component';

describe('BudgetComponent', () => {
  let component: BudgetComponent;
  let fixture: ComponentFixture<BudgetComponent>;
  let router: Router;
  let tripPlanningService: jasmine.SpyObj<TripPlanningService>;
  let tripTempService: jasmine.SpyObj<TripTempService>;

  beforeEach(async () => {
    tripPlanningService = jasmine.createSpyObj<TripPlanningService>('TripPlanningService', [
      'saveBudgetStep',
    ]);
    tripTempService = jasmine.createSpyObj<TripTempService>('TripTempService', [
      'getTripTemp',
      'updateTripTemp',
    ]);
    tripTempService.getTripTemp.and.returnValue({
      tripName: '',
      budget: null,
      currency: 'EUR',
      durationNights: 0,
      travelStyle: 'Mid-range',
      origin: '',
      destination: '',
      destinationCities: [],
      departureDate: '',
      returnDate: '',
      travelers: 2,
      selectedFlightId: '',
      selectedFlightAirline: '',
      selectedFlightNumber: '',
      selectedFlightDepartureTime: '',
      selectedFlightArrivalTime: '',
      selectedFlightDuration: '',
      selectedFlightStops: '',
      selectedFlightTotal: null,
      selectedHotelName: '',
      selectedHotelCity: '',
      selectedHotelStars: null,
      selectedHotelTotal: null,
      selectedActivities: [],
      selectedActivitiesTotal: 0,
    });

    await TestBed.configureTestingModule({
      imports: [BudgetComponent],
      providers: [
        provideRouter([{ path: 'trips/create/destination', component: BudgetComponent }]),
        { provide: TripPlanningService, useValue: tripPlanningService },
        { provide: TripTempService, useValue: tripTempService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BudgetComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  it('starts with zero nights and zero manual budget', () => {
    expect(component.budgetForm.controls.nights.value).toBe(0);
    expect(component.budgetForm.controls.totalBudget.value).toBe(0);
    expect(component.recommendedBudget()).toBe(0);
  });

  it('disables continue until required budget details are entered', () => {
    const recommendedButton = fixture.nativeElement.querySelector(
      '.recommended-continue-button',
    ) as HTMLButtonElement;
    const manualButton = fixture.nativeElement.querySelector(
      '.manual-continue-button',
    ) as HTMLButtonElement;

    expect(recommendedButton.disabled).toBeTrue();
    expect(manualButton.disabled).toBeTrue();

    component.budgetForm.controls.tripName.setValue('Summer in Italy');
    fixture.detectChanges();

    expect(recommendedButton.disabled).toBeTrue();
    expect(manualButton.disabled).toBeTrue();

    component.budgetForm.controls.nights.setValue(7);
    component.budgetForm.controls.totalBudget.setValue(2450);
    component.selectTravelStyle('mid-range');
    fixture.detectChanges();

    expect(recommendedButton.disabled).toBeFalse();
    expect(manualButton.disabled).toBeFalse();
  });

  it('disables only manual continue when the manual budget is not greater than zero', () => {
    component.budgetForm.controls.tripName.setValue('Summer in Italy');
    component.budgetForm.controls.nights.setValue(7);
    component.budgetForm.controls.totalBudget.setValue(0);
    component.selectTravelStyle('mid-range');
    fixture.detectChanges();

    const recommendedButton = fixture.nativeElement.querySelector(
      '.recommended-continue-button',
    ) as HTMLButtonElement;
    const manualButton = fixture.nativeElement.querySelector(
      '.manual-continue-button',
    ) as HTMLButtonElement;

    expect(component.budgetForm.controls.totalBudget.invalid).toBeTrue();
    expect(recommendedButton.disabled).toBeFalse();
    expect(manualButton.disabled).toBeTrue();
  });

  it('does not call the backend when the selected flow is invalid', () => {
    component.continueWithRecommendedBudget();
    component.continueWithManualBudget();

    expect(tripPlanningService.saveBudgetStep).not.toHaveBeenCalled();
  });

  it('does not reduce the duration below zero nights', () => {
    component.budgetForm.controls.nights.setValue(0);
    component.adjustNights(-1);

    expect(component.budgetForm.controls.nights.value).toBe(0);
  });

  it('recommends a budget based on travel style and duration', () => {
    component.budgetForm.controls.nights.setValue(2);
    component.selectTravelStyle('luxury');

    expect(component.recommendedBudget()).toBe(1800);
  });

  it('keeps a manually edited budget independent from recommendations', () => {
    component.budgetForm.controls.totalBudget.setValue(1234);
    component.budgetForm.controls.nights.setValue(7);
    component.adjustNights(1);
    component.selectTravelStyle('luxury');

    expect(component.budgetForm.controls.totalBudget.value).toBe(1234);
    expect(component.recommendedBudget()).toBe(7200);
  });

  it('sends the recommended budget even when the manual budget is invalid', () => {
    const navigateSpy = spyOn(router, 'navigate').and.resolveTo(true);
    const response: TripBudgetResponse = {
      id: 10,
      tripName: 'Summer in Italy',
      budget: 2450,
      currency: 'EUR',
      duration: 7,
      travelStyle: 'Mid-range',
    };
    const saveResult = new Subject<TripBudgetResponse>();
    tripPlanningService.saveBudgetStep.and.returnValue(saveResult);
    component.budgetForm.controls.tripName.setValue('Summer in Italy');
    component.budgetForm.controls.nights.setValue(7);
    component.budgetForm.controls.totalBudget.setValue(0);
    component.selectTravelStyle('mid-range');

    component.continueWithRecommendedBudget();

    expect(tripPlanningService.saveBudgetStep).toHaveBeenCalledWith({
      tripName: 'Summer in Italy',
      budget: 2450,
      currency: 'EUR',
      duration: 7,
      travelStyle: 'Mid-range',
    });
    expect(tripTempService.updateTripTemp).toHaveBeenCalledWith({
      tripName: 'Summer in Italy',
      budget: 2450,
      currency: 'EUR',
      durationNights: 7,
      travelStyle: 'Mid-range',
    });

    saveResult.next(response);
    saveResult.complete();

    expect(component.savedTripPlanningId()).toBe(10);
    expect(navigateSpy).toHaveBeenCalledWith(['/trips/create/destination'], {
      queryParams: { tripPlanningId: 10 },
    });
  });

  it('sends the user-entered budget through the manual flow', () => {
    tripPlanningService.saveBudgetStep.and.returnValue(new Subject<TripBudgetResponse>());
    component.budgetForm.controls.tripName.setValue('Summer in Italy');
    component.budgetForm.controls.totalBudget.setValue(1234);
    component.budgetForm.controls.nights.setValue(7);

    component.continueWithManualBudget();

    expect(tripPlanningService.saveBudgetStep).toHaveBeenCalledWith({
      tripName: 'Summer in Italy',
      budget: 1234,
      currency: 'EUR',
      duration: 7,
      travelStyle: 'Mid-range',
    });
    expect(tripTempService.updateTripTemp).toHaveBeenCalledWith({
      tripName: 'Summer in Italy',
      budget: 1234,
      currency: 'EUR',
      durationNights: 7,
      travelStyle: 'Mid-range',
    });
  });

  it('shows an error message when saving fails', () => {
    tripPlanningService.saveBudgetStep.and.returnValue(
      throwError(() => new Error('Backend unavailable')),
    );
    component.budgetForm.controls.tripName.setValue('Summer in Italy');
    component.budgetForm.controls.totalBudget.setValue(1234);
    component.budgetForm.controls.nights.setValue(7);

    component.continueWithManualBudget();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.save-error').textContent).toContain(
      'Could not save your budget. Please try again.',
    );
  });

  it('disables continue while saving', () => {
    tripPlanningService.saveBudgetStep.and.returnValue(new Subject<TripBudgetResponse>());
    component.budgetForm.controls.tripName.setValue('Summer in Italy');
    component.budgetForm.controls.nights.setValue(7);
    component.selectTravelStyle('mid-range');

    component.continueWithRecommendedBudget();
    fixture.detectChanges();

    const continueButtons = fixture.nativeElement.querySelectorAll(
      '.continue-button',
    ) as NodeListOf<HTMLButtonElement>;

    expect(component.isSaving()).toBeTrue();
    expect(Array.from(continueButtons).every((button) => button.disabled)).toBeTrue();
    expect(Array.from(continueButtons).every((button) => button.textContent?.includes('Saving...'))).toBeTrue();
  });
});
