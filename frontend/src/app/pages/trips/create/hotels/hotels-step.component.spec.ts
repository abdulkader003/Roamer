import { ComponentFixture, TestBed } from '@angular/core/testing';
import { convertToParamMap, ActivatedRoute, provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { Hotel } from '../../../hotels/models/hotel.model';
import { HotelService } from '../../../hotels/services/hotel.service';
import { TripHotelResponse, TripPlanningService } from '../../../../services/trip-planning.service';
import { HotelsStepComponent } from './hotels-step.component';

describe('HotelsStepComponent', () => {
  let fixture: ComponentFixture<HotelsStepComponent>;
  let component: HotelsStepComponent;
  let hotelService: jasmine.SpyObj<HotelService>;
  let tripPlanningService: jasmine.SpyObj<TripPlanningService>;

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
    image: 'hotel.jpg',
  };
  const tripHotelFixture = { ...hotelFixture, tripCity: 'Barcelona' };
  const multiImageHotelFixture = {
    ...tripHotelFixture,
    images: ['hotel-1.jpg', 'hotel-2.jpg', 'hotel-3.jpg'],
  };

  function setup(queryParams: Record<string, string | string[]> = { tripPlanningId: '10' }) {
    TestBed.resetTestingModule();
    hotelService = jasmine.createSpyObj<HotelService>('HotelService', ['searchHotels']);
    tripPlanningService = jasmine.createSpyObj<TripPlanningService>('TripPlanningService', [
      'saveHotelStep',
    ]);
    hotelService.searchHotels.and.returnValue(of([hotelFixture]));

    TestBed.configureTestingModule({
      imports: [HotelsStepComponent],
      providers: [
        provideRouter([]),
        { provide: HotelService, useValue: hotelService },
        { provide: TripPlanningService, useValue: tripPlanningService },
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
      images: ['paris-1.jpg', 'paris-2.jpg'],
    };
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
      images: ['hotel-1.jpg', '', '   ', null as unknown as string, 'hotel-1.jpg', 'hotel-2.jpg'],
    };

    component.hotels.set([hotelWithInvalidImages]);
    fixture.detectChanges();

    expect(component.cardImages(hotelWithInvalidImages)).toEqual(['hotel-1.jpg', 'hotel-2.jpg']);
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
      images: ['paris-1.jpg', 'paris-2.jpg'],
    };
    component.hotels.set([multiImageHotelFixture, parisHotel]);

    component.handleHotelImageError(multiImageHotelFixture, 'hotel-2.jpg');

    expect(component.cardImages(multiImageHotelFixture)).toEqual(['hotel-1.jpg', 'hotel-3.jpg']);
    expect(component.cardImages(parisHotel)).toEqual(['paris-1.jpg', 'paris-2.jpg']);
  });
});
