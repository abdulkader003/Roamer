import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { HotelSearchComponent } from './hotel-search.component';
import { Hotel } from '../models/hotel.model';
import { HotelService } from '../services/hotel.service';

const hotelFixture: Hotel = {
  id: 1,
  name: 'Berlin Central Stay',
  city: 'Berlin',
  pricePerNight: 180,
  rating: 4.5,
  stars: 4,
  checkIn: '',
  checkOut: '',
  distance: '1.2 km from center',
  tag: 'City favorite',
  description: 'Comfortable central hotel.',
  amenities: ['Wi-Fi', 'Breakfast'],
  image: 'hotel.jpg',
};

describe('HotelSearch', () => {
  let component: HotelSearchComponent;
  let fixture: ComponentFixture<HotelSearchComponent>;
  let hotelService: jasmine.SpyObj<HotelService>;

  beforeEach(async () => {
    hotelService = jasmine.createSpyObj<HotelService>('HotelService', ['searchHotels']);
    hotelService.searchHotels.and.returnValue(of([hotelFixture]));

    await TestBed.configureTestingModule({
      imports: [HotelSearchComponent],
      providers: [
        provideRouter([]),
        { provide: HotelService, useValue: hotelService },
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(HotelSearchComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders hotel cards after searching Berlin stays', () => {
    spyOn(console, 'log');
    spyOn(window, 'requestAnimationFrame').and.returnValue(0);

    component.location = 'Berlin';
    component.checkIn = '2026-06-03';
    component.checkOut = '2026-06-06';

    component.search();
    fixture.detectChanges();

    const cards = fixture.nativeElement.querySelectorAll('.hotel-card');

    expect(component.isSearching).toBeFalse();
    expect(component.isLoading).toBeFalse();
    expect(component.hotels.length).toBeGreaterThan(0);
    expect(cards.length).toBeGreaterThan(0);
    expect(fixture.nativeElement.textContent).not.toContain('Preparing results');
    expect(fixture.nativeElement.textContent).not.toContain('Searching');
  });

  it('suggests Tokyo for case-insensitive partial destination input', () => {
    component.updateLocationText('Tok');
    expect(component.activeCitySuggestions).toBeTrue();
    expect(component.citySuggestions).toContain('Tokyo');

    component.updateLocationText('tok');
    expect(component.citySuggestions).toContain('Tokyo');

    component.updateLocationText('yo');
    expect(component.citySuggestions).toContain('Tokyo');
  });

  it('suggests German hotel destinations with umlaut-free and translated aliases', () => {
    component.updateLocationText('Dor');
    expect(component.citySuggestions).toContain('Dortmund');

    component.updateLocationText('Duss');
    expect(component.citySuggestions).toContain('Düsseldorf');

    component.updateLocationText('Ess');
    expect(component.citySuggestions).toContain('Essen');

    component.updateLocationText('Koln');
    expect(component.citySuggestions).toContain('Köln');

    component.updateLocationText('Cologne');
    expect(component.citySuggestions).toContain('Köln');

    component.updateLocationText('Munich');
    expect(component.citySuggestions).toContain('München');

    component.updateLocationText('Muenchen');
    expect(component.citySuggestions).toContain('München');
  });

  it('opens the destination overlay on focus and shows matches after typing', () => {
    component.location = '';
    component.showCitySuggestions();
    expect(component.activeCitySuggestions).toBeTrue();
    expect(component.citySuggestions).toEqual([]);

    component.updateLocationText('T');
    expect(component.activeCitySuggestions).toBeTrue();
    expect(component.citySuggestions.length).toBeGreaterThan(0);

    component.updateLocationText('');
    expect(component.activeCitySuggestions).toBeTrue();
    expect(component.citySuggestions).toEqual([]);
  });

  it('keeps the destination overlay open when input has no matches', () => {
    component.updateLocationText('zzzzzz');

    expect(component.citySuggestions).toEqual([]);
    expect(component.activeCitySuggestions).toBeTrue();
  });

  it('keeps city selection from the suggestions dropdown working', () => {
    component.updateLocationText('Tok');
    component.selectDestination('Tokyo');

    expect(component.location).toBe('Tokyo');
    expect(component.activeCitySuggestions).toBeFalse();
  });

  it('keeps destination options unique by city name', () => {
    const uniqueCityNames = new Set(component.cityOptions.map((city) => city.toLowerCase()));

    expect(uniqueCityNames.size).toBe(component.cityOptions.length);
  });
});
