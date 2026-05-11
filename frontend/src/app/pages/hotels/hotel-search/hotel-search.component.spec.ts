import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { of } from 'rxjs';

import { HotelSearchComponent } from './hotel-search.component';
import { HotelService } from '../services/hotel.service';
import { Hotel } from '../models/hotel.model';

describe('HotelSearch', () => {
  let component: HotelSearchComponent;
  let fixture: ComponentFixture<HotelSearchComponent>;
  let hotelService: jasmine.SpyObj<HotelService>;

  const hotels: Hotel[] = [
    {
      id: 1,
      name: 'Berlin Central House',
      city: 'Berlin',
      pricePerNight: 150,
      rating: 4.6,
      ratingScore: 9.1,
      ratingLabel: 'Exceptional',
      reviewCount: 420,
      stars: 4,
      checkIn: '2026-06-03',
      checkOut: '2026-06-06',
      distance: 'Around Mitte, Berlin',
      distanceFromCenter: '1.2 km from city center',
      tag: 'Top pick',
      description: 'A central Berlin stay.',
      amenities: ['Free WiFi', 'Breakfast'],
      adults: 2,
      children: 0,
      image: 'https://example.com/hotel.jpg',
      images: ['https://example.com/hotel.jpg']
    }
  ];

  beforeEach(async () => {
    hotelService = jasmine.createSpyObj<HotelService>('HotelService', ['searchHotels']);
    hotelService.searchHotels.and.returnValue(of(hotels));

    await TestBed.configureTestingModule({
      imports: [HotelSearchComponent],
      providers: [
        {
          provide: HotelService,
          useValue: hotelService
        }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HotelSearchComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders hotel cards after searching Berlin stays', fakeAsync(() => {
    spyOn(window, 'requestAnimationFrame').and.returnValue(0);

    component.location = 'Berlin';
    component.checkIn = '2026-06-03';
    component.checkOut = '2026-06-06';

    component.search();
    tick();
    fixture.detectChanges();

    const cards = fixture.nativeElement.querySelectorAll('.hotel-card');

    expect(hotelService.searchHotels).toHaveBeenCalledWith('Berlin', '2026-06-03', '2026-06-06', 2, 0);
    expect(component.isSearching).toBeFalse();
    expect(component.isLoading).toBeFalse();
    expect(component.hotels.length).toBeGreaterThan(0);
    expect(cards.length).toBeGreaterThan(0);
    expect(fixture.nativeElement.textContent).not.toContain('Preparing results');
    expect(fixture.nativeElement.textContent).not.toContain('Searching');
  }));
});
