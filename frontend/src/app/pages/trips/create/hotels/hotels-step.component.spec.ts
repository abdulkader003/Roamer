import { ComponentFixture, TestBed } from '@angular/core/testing';
import { convertToParamMap, ActivatedRoute, provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { Hotel } from '../../../hotels/models/hotel.model';
import { HotelService } from '../../../hotels/services/hotel.service';
import { TripHotelResponse, TripPlanningService } from '../../../../services/trip-planning.service';
import { TripTempService } from '../trip-temp.service';
import { HotelsStepComponent } from './hotels-step.component';

describe('HotelsStepComponent', () => {
  let fixture: ComponentFixture<HotelsStepComponent>;
  let component: HotelsStepComponent;
  let hotelService: jasmine.SpyObj<HotelService>;
  let tripPlanningService: jasmine.SpyObj<TripPlanningService>;
  let tripTempService: jasmine.SpyObj<TripTempService>;
  const imageDataUrl = (label: string) =>
    `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'%3E%3Ctext x='1' y='8'%3E${label}%3C/text%3E%3C/svg%3E`;

  const hotelFixture: Hotel = {
    id: 77,
    name: 'Barcelona Grand',
    city: 'Barcelona',
    pricePerNight: 220,
    rating: 4.6,
    ratingScore: 9.1,
    ratingLabel: 'Superb',
    reviewCount: 120,
    stars: 5,
    checkIn: '2026-07-20',
    checkOut: '2026-07-27',
    distance: '0.8 km from center',
    tag: 'Recommended',
    description: 'Elegant stay near the Gothic Quarter.',
    amenities: ['Free Wi-Fi', 'Pool', 'Breakfast'],
    image: imageDataUrl('h'),
  };
  const tripHotelFixture = { ...hotelFixture, tripCity: 'Barcelona' };
  const multiImageHotelFixture = {
    ...tripHotelFixture,
    images: [imageDataUrl('b1'), imageDataUrl('b2'), imageDataUrl('b3')],
  };

  function setup(queryParams: Record<string, string | string[]> = { tripPlanningId: '10' }) {
    TestBed.resetTestingModule();
    hotelService = jasmine.createSpyObj<HotelService>('HotelService', ['searchHotels']);
    tripPlanningService = jasmine.createSpyObj<TripPlanningService>('TripPlanningService', [
      'saveHotelStep',
    ]);
    tripTempService = jasmine.createSpyObj<TripTempService>('TripTempService', ['getTripTemp', 'updateTripTemp']);
    tripTempService.getTripTemp.and.returnValue({
      tripPlanningId: 10,
      tripName: 'Summer in Barcelona',
      budget: 2000,
      currency: 'EUR',
      durationNights: 7,
      travelStyle: 'Mid-range',
      origin: 'Frankfurt (FRA)',
      destination: 'Barcelona (BCN)',
      destinationCities: ['Barcelona'],
      departureDate: '2026-07-14',
      returnDate: '2026-07-21',
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
    hotelService.searchHotels.and.returnValue(of([hotelFixture]));

    TestBed.configureTestingModule({
      imports: [HotelsStepComponent],
      providers: [
        provideRouter([]),
        { provide: HotelService, useValue: hotelService },
        { provide: TripPlanningService, useValue: tripPlanningService },
        { provide: TripTempService, useValue: tripTempService },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap(queryParams),
            },
          },
        },
      ],
    });

    fixture = TestBed.createComponent(HotelsStepComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({}).compileComponents();
    setup();
  });

  it('renders loaded hotels', () => {
    expect(hotelService.searchHotels).toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Barcelona Grand');
  });

  it('describes the hotel search using the trip dates, nights, guests, and destination city', () => {
    expect(component.subtitle()).toBe(
      'Showing hotel options in Barcelona · 14 Jul 2026 to 21 Jul 2026 · 7 nights · 2 guests.',
    );
  });

  it('highlights the selected hotel', () => {
    component.selectHotel(tripHotelFixture);
    fixture.detectChanges();

    const selectedCard = fixture.nativeElement.querySelector('.hotel-card--selected');
    expect(selectedCard).toBeTruthy();
  });

  it('deselects the selected hotel when clicked again', () => {
    component.selectHotel(tripHotelFixture);
    component.selectHotel(tripHotelFixture);
    fixture.detectChanges();

    expect(component.selectedHotel()).toBeNull();
    expect(fixture.nativeElement.querySelector('.hotel-card--selected')).toBeNull();
  });

  it('disables continue until a hotel is selected', () => {
    const continueButton = fixture.nativeElement.querySelector('.continue-button') as HTMLButtonElement;

    expect(continueButton.disabled).toBeTrue();

    component.selectHotel(tripHotelFixture);
    fixture.detectChanges();

    expect(continueButton.disabled).toBeFalse();
  });

  it('disables continue again after the selected hotel is deselected', () => {
    const continueButton = fixture.nativeElement.querySelector('.continue-button') as HTMLButtonElement;

    component.selectHotel(tripHotelFixture);
    fixture.detectChanges();
    expect(continueButton.disabled).toBeFalse();

    component.selectHotel(tripHotelFixture);
    fixture.detectChanges();

    expect(continueButton.disabled).toBeTrue();
  });

  it('does not save without a hotel selection', () => {
    component.continueToActivities();

    expect(tripPlanningService.saveHotelStep).not.toHaveBeenCalled();
  });

  it('saves the selected hotel for the current trip planning record', () => {
    const response: TripHotelResponse = {
      tripPlanningId: 10,
      hotelId: 77,
      hotelName: 'Barcelona Grand',
      hotelCity: 'Barcelona',
      pricePerNight: 220,
      stars: 5,
      ratingScore: 9.1,
      ratingLabel: 'Superb',
    };
    const saveResult = new Subject<TripHotelResponse>();
    tripPlanningService.saveHotelStep.and.returnValue(saveResult);

    component.selectHotel(tripHotelFixture);
    component.continueToActivities();

    expect(tripPlanningService.saveHotelStep).toHaveBeenCalledWith(10, { hotelId: 77 });

    saveResult.next(response);
    saveResult.complete();
  });

  it('loads hotels for every selected city', () => {
    setup({ tripPlanningId: '10', city: ['Barcelona', 'Paris'] });

    expect(hotelService.searchHotels).toHaveBeenCalledWith(
      'Barcelona',
      jasmine.any(String),
      jasmine.any(String),
      2,
      0,
    );
    expect(hotelService.searchHotels).toHaveBeenCalledWith(
      'Paris',
      jasmine.any(String),
      jasmine.any(String),
      2,
      0,
    );
    expect(component.cityGroups().map((group) => group.city)).toEqual(['Barcelona', 'Paris']);
  });

  it('loads hotels for every multi-city destination city', () => {
    setup({
      tripPlanningId: '10',
      multiCitySegments: JSON.stringify([
        { fromText: 'Frankfurt (FRA)', toText: 'Barcelona (BCN)', date: '2026-07-14' },
        { fromText: 'Barcelona (BCN)', toText: 'Rome (FCO)', date: '2026-07-18' },
      ]),
    });

    expect(hotelService.searchHotels).toHaveBeenCalledWith(
      'Barcelona',
      jasmine.any(String),
      jasmine.any(String),
      2,
      0,
    );
    expect(hotelService.searchHotels).toHaveBeenCalledWith(
      'Rome',
      jasmine.any(String),
      jasmine.any(String),
      2,
      0,
    );
    expect(component.selectedCities()).toEqual(['Barcelona', 'Rome']);
    expect(component.subtitle()).toBe(
      'Showing hotel options across Barcelona and Rome · 14 Jul 2026 to 21 Jul 2026 · 7 nights · 2 guests.',
    );
  });

  it('shows available hotels when one city search fails', () => {
    hotelService.searchHotels.and.callFake((city: string) =>
      city === 'Paris' ? throwError(() => new Error('Provider unavailable')) : of([hotelFixture]),
    );

    component.selectedCities.set(['Barcelona', 'Paris']);
    component.loadHotels();
    fixture.detectChanges();

    expect(component.hotels().length).toBe(1);
    expect(component.loadWarning()).toContain('Paris');
    expect(component.loadError()).toBe('');
  });

  it('changes only the selected hotel card image index through dots', () => {
    const parisHotel = {
      ...hotelFixture,
      id: 88,
      name: 'Paris Central',
      city: 'Paris',
      tripCity: 'Paris',
      images: [imageDataUrl('p1'), imageDataUrl('p2')],
    };
    component.selectedCities.set(['Barcelona', 'Paris']);
    component.hotels.set([multiImageHotelFixture, parisHotel]);
    fixture.detectChanges();

    component.selectHotelImage(multiImageHotelFixture, 1, new MouseEvent('click'));

    expect(component.currentImageIndex(multiImageHotelFixture)).toBe(1);
    expect(component.currentImageIndex(parisHotel)).toBe(0);
    expect(fixture.nativeElement.querySelector('.carousel-arrow')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.carousel-dot').length).toBe(5);
  });

  it('hides carousel controls when only one hotel image exists', () => {
    component.hotels.set([tripHotelFixture]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.carousel-arrow')).toBeNull();
    expect(fixture.nativeElement.querySelector('.carousel-dot')).toBeNull();
  });

  it('shows dots only for valid hotel images', () => {
    const hotelWithInvalidImages = {
      ...tripHotelFixture,
      images: [imageDataUrl('b1'), '', '   ', null as unknown as string, imageDataUrl('b1'), imageDataUrl('b2')],
    };

    component.hotels.set([hotelWithInvalidImages]);
    fixture.detectChanges();

    expect(component.cardImages(hotelWithInvalidImages)).toEqual([imageDataUrl('b1'), imageDataUrl('b2')]);
    expect(fixture.nativeElement.querySelectorAll('.carousel-dot').length).toBe(2);
  });

  it('uses fallback image and hides dots when no valid hotel image exists', () => {
    const hotelWithoutImages = {
      ...tripHotelFixture,
      image: '',
      images: ['', null as unknown as string],
    };

    component.hotels.set([hotelWithoutImages]);
    fixture.detectChanges();

    const image: HTMLImageElement = fixture.nativeElement.querySelector('.hotel-image');
    expect(component.cardImages(hotelWithoutImages)).toEqual([]);
    expect(image.src).toContain('data:image/svg+xml');
    expect(fixture.nativeElement.querySelector('.carousel-dot')).toBeNull();
  });

  it('removes a broken image from only that hotel carousel', () => {
    const parisHotel = {
      ...hotelFixture,
      id: 88,
      name: 'Paris Central',
      city: 'Paris',
      tripCity: 'Paris',
      images: [imageDataUrl('p1'), imageDataUrl('p2')],
    };
    component.hotels.set([multiImageHotelFixture, parisHotel]);

    component.handleHotelImageError(multiImageHotelFixture, imageDataUrl('b2'));

    expect(component.cardImages(multiImageHotelFixture)).toEqual([imageDataUrl('b1'), imageDataUrl('b3')]);
    expect(component.cardImages(parisHotel)).toEqual([imageDataUrl('p1'), imageDataUrl('p2')]);
  });
});
