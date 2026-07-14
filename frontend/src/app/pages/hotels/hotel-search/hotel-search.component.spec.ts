import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { HotelSearchComponent } from './hotel-search.component';
import { Hotel } from '../models/hotel.model';
import { CalendarService } from '../services/calendar.service';
import { HotelService } from '../services/hotel.service';

const validCheckIn = '2099-06-03';
const validCheckOut = '2099-06-06';

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
        {
          provide: CalendarService,
          useValue: jasmine.createSpyObj<CalendarService>('CalendarService', [
            'addEventOrRedirectToLogin',
          ]),
        },
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

  it('renders the destination input', () => {
    const destinationInput: HTMLInputElement =
      fixture.nativeElement.querySelector('input[name="location"]');

    expect(destinationInput).toBeTruthy();
    expect(destinationInput.placeholder).toBe('Where are you traveling to?');
  });

  it('renders the check-in input', () => {
    const checkInInput: HTMLButtonElement =
      fixture.nativeElement.querySelector('[aria-label="Choose check-in date"]');

    expect(checkInInput).toBeTruthy();
    expect(checkInInput.textContent).toContain('Check-in');
  });

  it('renders the check-out input', () => {
    const checkOutInput: HTMLButtonElement =
      fixture.nativeElement.querySelector('[aria-label="Choose check-out date"]');

    expect(checkOutInput).toBeTruthy();
    expect(checkOutInput.textContent).toContain('Check-out');
  });

  it('renders the search button', () => {
    const searchButton: HTMLButtonElement = fixture.nativeElement.querySelector('.search-btn');

    expect(searchButton).toBeTruthy();
    expect(searchButton.type).toBe('submit');
    expect(searchButton.textContent).toContain('Search stays');
  });

  it('triggers the search action when the search button is clicked', () => {
    const searchSpy = spyOn(component, 'search');
    const searchButton: HTMLButtonElement = fixture.nativeElement.querySelector('.search-btn');

    searchButton.click();

    expect(searchSpy).toHaveBeenCalled();
  });

  it('executes hotel search logic for a valid form', () => {
    spyOn(window, 'requestAnimationFrame').and.returnValue(0);
    component.location = 'Berlin';
    component.checkIn = validCheckIn;
    component.checkOut = validCheckOut;

    component.search();

    expect(hotelService.searchHotels).toHaveBeenCalledWith(
      'Berlin',
      validCheckIn,
      validCheckOut,
      component.adults,
      component.children
    );
    expect(component.hasSearched).toBeTrue();
    expect(component.hotels).toEqual([jasmine.objectContaining({ name: hotelFixture.name })]);
  });

  it('prevents hotel search execution for an invalid form', () => {
    component.location = '';
    component.checkIn = '';
    component.checkOut = '';

    component.search();

    expect(hotelService.searchHotels).not.toHaveBeenCalled();
    expect(component.dateError).toBe('Please fill all required fields');
    expect(component.hasSearched).toBeFalse();
  });

  it('renders hotel cards after searching Berlin stays', () => {
    spyOn(console, 'log');
    spyOn(window, 'requestAnimationFrame').and.returnValue(0);

    component.location = 'Berlin';
    component.checkIn = validCheckIn;
    component.checkOut = validCheckOut;

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

  it('shows inline destination suggestions on focus and typing without opening a modal', () => {
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

  it('lets users type directly into the destination field and see inline suggestions', () => {
    const destinationInput: HTMLInputElement = fixture.nativeElement.querySelector('input[name="location"]');

    destinationInput.dispatchEvent(new Event('focus'));
    destinationInput.value = 'Tok';
    destinationInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(component.location).toBe('Tok');
    expect(component.activeCitySuggestions).toBeTrue();
    expect(fixture.nativeElement.querySelector('.city-popover')).toBeNull();
    expect(fixture.nativeElement.querySelector('.city-popover-backdrop')).toBeNull();
    const dropdown: HTMLElement = fixture.nativeElement.querySelector('.city-suggestions');
    const searchPanel: HTMLElement = fixture.nativeElement.querySelector('.search-panel');
    const searchStage: HTMLElement = fixture.nativeElement.querySelector('.search-stage');
    const searchCard: HTMLElement = fixture.nativeElement.querySelector('.search-card');
    expect(dropdown).toBeTruthy();
    expect(dropdown.classList).toContain('city-suggestions--floating');
    expect(searchPanel.contains(dropdown)).toBeFalse();
    expect(searchCard.contains(dropdown)).toBeFalse();
    expect(searchStage.contains(dropdown)).toBeFalse();
    expect(component.citySuggestionsStyle['top']).toBeTruthy();
    expect(component.citySuggestionsStyle['width']).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Tokyo');
  });

  it('keeps the inline destination suggestions open when input has no matches', () => {
    component.updateLocationText('zzzzzz');
    fixture.detectChanges();

    expect(component.citySuggestions).toEqual([]);
    expect(component.activeCitySuggestions).toBeTrue();
    expect(fixture.nativeElement.querySelector('.city-suggestions')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('No matching destinations found.');
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
