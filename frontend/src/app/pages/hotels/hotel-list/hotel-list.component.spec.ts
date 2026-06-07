import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HotelListComponent } from './hotel-list.component';
import { Hotel } from '../models/hotel.model';
import { CalendarService } from '../services/calendar.service';
import { AuthService } from '../../../services/auth';

const mockHotels: Hotel[] = [
  {
    id: 1,
    name: 'Berlin Central Stay',
    city: 'Berlin',
    pricePerNight: 180,
    rating: 4.5,
    stars: 4,
    checkIn: '2026-06-03',
    checkOut: '2026-06-06',
    distance: '1.2 km from center',
    tag: 'City favorite',
    description: 'Comfortable central hotel.',
    amenities: ['Wi-Fi', 'Breakfast'],
    image: 'berlin-hotel.jpg',
  },
  {
    id: 2,
    name: 'Munich Garden Hotel',
    city: 'Munich',
    pricePerNight: 220,
    rating: 4.8,
    stars: 5,
    checkIn: '2026-06-03',
    checkOut: '2026-06-06',
    distance: '2 km from center',
    tag: 'Guest favorite',
    description: 'Quiet hotel close to the city center.',
    amenities: ['Spa', 'Parking'],
    image: 'munich-hotel.jpg',
  },
];

describe('HotelList', () => {
  let component: HotelListComponent;
  let fixture: ComponentFixture<HotelListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HotelListComponent],
      providers: [
        {
          provide: CalendarService,
          useValue: jasmine.createSpyObj<CalendarService>('CalendarService', [
            'addEventOrRedirectToLogin',
          ]),
        },
        {
          provide: AuthService,
          useValue: jasmine.createSpyObj<AuthService>('AuthService', ['isAuthenticated']),
        },
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(HotelListComponent);
    component = fixture.componentInstance;
    component.hotels = mockHotels;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders a list of hotels', () => {
    const textContent: string = fixture.nativeElement.textContent;

    expect(textContent).toContain(mockHotels[0].name);
    expect(textContent).toContain(mockHotels[1].name);
  });

  it('displays the correct number of hotel cards', () => {
    const hotelCards = fixture.nativeElement.querySelectorAll('.hotel-card');

    expect(hotelCards.length).toBe(mockHotels.length);
  });

  it('shows an empty state when no hotels exist', () => {
    component.hotels = [];
    fixture.detectChanges();

    const emptyState: HTMLElement = fixture.nativeElement.querySelector('.empty-state');

    expect(emptyState).toBeTruthy();
    expect(emptyState.textContent).toContain('No hotels available.');
    expect(fixture.nativeElement.querySelectorAll('.hotel-card').length).toBe(0);
  });
});
