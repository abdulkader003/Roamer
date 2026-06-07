import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HotelCardComponent } from './hotel-card.component';
import { Hotel } from '../models/hotel.model';
import { CalendarService } from '../services/calendar.service';

const mockHotel: Hotel = {
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
  image: 'hotel.jpg',
};

describe('HotelCard', () => {
  let component: HotelCardComponent;
  let fixture: ComponentFixture<HotelCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HotelCardComponent],
      providers: [
        {
          provide: CalendarService,
          useValue: jasmine.createSpyObj<CalendarService>('CalendarService', [
            'addEventOrRedirectToLogin',
          ]),
        },
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(HotelCardComponent);
    component = fixture.componentInstance;
    component.hotel = mockHotel;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders the hotel name', () => {
    const heading: HTMLElement = fixture.nativeElement.querySelector('h3');

    expect(heading.textContent).toContain(mockHotel.name);
  });

  it('renders the hotel price', () => {
    const priceBlock: HTMLElement = fixture.nativeElement.querySelector('.price-block');

    expect(priceBlock.textContent).toContain(`Price per night: ${mockHotel.pricePerNight} EUR`);
  });

  it('renders the hotel location', () => {
    expect(fixture.nativeElement.textContent).toContain(mockHotel.city);
  });

  it('renders the hotel image when available', () => {
    const image: HTMLImageElement = fixture.nativeElement.querySelector('.gallery-main');

    expect(image).toBeTruthy();
    expect(image.getAttribute('src')).toBe(mockHotel.image);
    expect(image.getAttribute('alt')).toBe(mockHotel.name);
  });
});
