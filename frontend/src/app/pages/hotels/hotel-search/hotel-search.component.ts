import { Component, ElementRef, ViewChild } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { HotelListComponent } from '../hotel-list/hotel-list.component';
import { Hotel } from '../models/hotel.model';

@Component({
  selector: 'app-hotel-search',
  standalone: true,
  imports: [HotelListComponent, FormsModule],
  templateUrl: './hotel-search.component.html',
  styleUrls: ['./hotel-search.component.css']
})
export class HotelSearchComponent {
  location = '';
  checkIn = '';
  checkOut = '';
  adults = 2;
  children = 0;
  guestsOpen = false;
  isLoading = false;
  hasSearched = false;
  dateError = '';
  guestError = '';
  hotels: Hotel[] = [];
  readonly maxGuests = 10;

  readonly popularDestinations = [
    'London',
    'Berlin',
    'Barcelona',
    'Madrid',
    'Paris',
    'Mailand',
    'Rom',
    'Madera',
    'Budapest',
    'Wien'
  ];

  @ViewChild('resultsSection') resultsSection!: ElementRef<HTMLElement>;

  search() {
    this.dateError = this.getDateError();
    this.guestError = this.getGuestError();

    if (this.dateError || this.guestError) {
      return;
    }

    this.guestsOpen = false;
    this.isLoading = true;
    this.hasSearched = true;

    setTimeout(() => {
      const selectedLocation = this.location.trim().toLowerCase();

      this.hotels = this.withSearchDetails(this.mockHotels()).filter((hotel) => {
        if (!selectedLocation) {
          return true;
        }

        return hotel.city.toLowerCase().includes(selectedLocation);
      });

      this.isLoading = false;

      setTimeout(() => {
        this.resultsSection.nativeElement.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }, 70);
    }, 550);
  }

  selectDestination(destination: string) {
    this.location = destination;
  }

  validateDates() {
    this.dateError = this.getDateError();
  }

  get guestSummary(): string {
    return `${this.adults} ${this.adults === 1 ? 'Adult' : 'Adults'}, ${this.children} ${this.children === 1 ? 'Child' : 'Children'}`;
  }

  toggleGuests() {
    this.guestsOpen = !this.guestsOpen;
  }

  changeGuests(type: 'adults' | 'children', change: number) {
    const nextAdults = type === 'adults' ? this.adults + change : this.adults;
    const nextChildren = type === 'children' ? this.children + change : this.children;

    if (nextAdults < 1 || nextChildren < 0 || nextAdults + nextChildren > this.maxGuests) {
      return;
    }

    this.adults = nextAdults;
    this.children = nextChildren;
    this.guestError = this.getGuestError();
  }

  private getDateError(): string {
    const today = this.getTodayDateString();

    if (!this.location.trim() || !this.checkIn || !this.checkOut) {
      return 'Please fill all required fields';
    }

    if ((this.checkIn && this.checkIn < today) || (this.checkOut && this.checkOut < today)) {
      return 'Dates cannot be in the past';
    }

    if (this.checkIn && this.checkOut && this.checkIn > this.checkOut) {
      return 'Invalid date selection';
    }

    return '';
  }

  private getGuestError(): string {
    if (this.adults < 1) {
      return 'At least one adult is required';
    }

    if (this.adults + this.children > this.maxGuests) {
      return `Maximum ${this.maxGuests} guests allowed`;
    }

    return '';
  }

  private getTodayDateString(): string {
    const today = new Date();
    const year = today.getFullYear();
    const month = `${today.getMonth() + 1}`.padStart(2, '0');
    const day = `${today.getDate()}`.padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  private withSearchDetails(hotels: Hotel[]): Hotel[] {
    return hotels.map((hotel) => ({
      ...hotel,
      checkIn: this.checkIn,
      checkOut: this.checkOut,
      adults: this.adults,
      children: this.children,
      images: hotel.images?.length ? hotel.images : this.getHotelImages(hotel.id, hotel.image)
    }));
  }

  private getHotelImages(id: number, fallbackImage: string): string[] {
    const galleries = [
      [
        'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=1200&q=80'
      ],
      [
        'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1590381105924-c72589b9ef3f?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1200&q=80'
      ],
      [
        'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1561501900-3701fa6a0864?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1551632436-cbf8dd35adfa?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1598928636135-d146006ff4be?auto=format&fit=crop&w=1200&q=80'
      ],
      [
        'https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1562790351-d273a961e0e9?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1568084680786-a84f91d1153c?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=1200&q=80'
      ]
    ];

    const selectedGallery = galleries[id % galleries.length];

    return Array.from(new Set([fallbackImage, ...selectedGallery])).slice(0, 6);
  }

  private mockHotels(): Hotel[] {
    return [
      {
        id: 1,
        name: 'The Kensington Row',
        city: 'London',
        pricePerNight: 285,
        rating: 4.7,
        stars: 5,
        distance: '0.9 km from city center',
        tag: 'Luxury townhouse',
        description: 'Elegant rooms near museums, refined service, and a calm private lounge for city breaks.',
        amenities: ['Free WiFi', 'Spa', 'Gym', 'Breakfast included', 'Restaurant'],
        image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80',
        images: [
          'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80',
          'https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=1200&q=80',
          'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1200&q=80',
          'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=1200&q=80',
          'https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?auto=format&fit=crop&w=1200&q=80'
        ],
        checkIn: '',
        checkOut: ''
      },
      {
        id: 2,
        name: 'Bankside Atelier Hotel',
        city: 'London',
        pricePerNight: 218,
        rating: 4.5,
        stars: 4,
        distance: '1.3 km from city center',
        tag: 'Design stay',
        description: 'A modern riverside stay with warm interiors, fast transport links, and polished dining.',
        amenities: ['Free WiFi', 'Restaurant', 'Air conditioning', 'Business center'],
        image: 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1200&q=80',
        images: [
          'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1200&q=80',
          'https://images.unsplash.com/photo-1590381105924-c72589b9ef3f?auto=format&fit=crop&w=1200&q=80',
          'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=1200&q=80',
          'https://images.unsplash.com/photo-1561501900-3701fa6a0864?auto=format&fit=crop&w=1200&q=80',
          'https://images.unsplash.com/photo-1598928636135-d146006ff4be?auto=format&fit=crop&w=1200&q=80'
        ],
        checkIn: '',
        checkOut: ''
      },
      {
        id: 3,
        name: 'Mayfair Garden Suites',
        city: 'London',
        pricePerNight: 340,
        rating: 4.8,
        stars: 5,
        distance: '0.6 km from city center',
        tag: 'Guest favorite',
        description: 'Spacious suites with discreet service, premium bedding, and an address close to Hyde Park.',
        amenities: ['Free WiFi', 'Parking', 'Spa', 'Pet friendly', 'Airport shuttle'],
        image: 'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1200&q=80',
        images: [
          'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1200&q=80',
          'https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1200&q=80',
          'https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=1200&q=80',
          'https://images.unsplash.com/photo-1562790351-d273a961e0e9?auto=format&fit=crop&w=1200&q=80',
          'https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=1200&q=80'
        ],
        checkIn: '',
        checkOut: ''
      },
      {
        id: 4,
        name: 'Camden Lock Hotel',
        city: 'London',
        pricePerNight: 154,
        rating: 4.2,
        stars: 3,
        distance: '3.1 km from city center',
        tag: 'Smart value',
        description: 'A lively boutique base with comfortable rooms, local restaurants, and easy underground access.',
        amenities: ['Free WiFi', 'Breakfast included', 'Pet friendly', 'Family rooms'],
        image: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80',
        checkIn: '',
        checkOut: ''
      },
      {
        id: 5,
        name: 'Westminster Grand',
        city: 'London',
        pricePerNight: 299,
        rating: 4.6,
        stars: 5,
        distance: '0.4 km from city center',
        tag: 'Central classic',
        description: 'Classic city luxury with landmark views, a quiet bar, and refined rooms for business or leisure.',
        amenities: ['Free WiFi', 'Gym', 'Restaurant', 'Air conditioning', 'Business center'],
        image: 'https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=1200&q=80',
        checkIn: '',
        checkOut: ''
      },
      {
        id: 6,
        name: 'Unter den Linden Palace',
        city: 'Berlin',
        pricePerNight: 190,
        rating: 4.6,
        stars: 5,
        distance: '0.5 km from city center',
        tag: 'Historic luxury',
        description: 'A polished central hotel with grand interiors, quiet rooms, and direct access to Berlin landmarks.',
        amenities: ['Free WiFi', 'Spa', 'Gym', 'Restaurant', 'Airport shuttle'],
        image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80',
        checkIn: '',
        checkOut: ''
      },
      {
        id: 7,
        name: 'Mitte Urban Retreat',
        city: 'Berlin',
        pricePerNight: 142,
        rating: 4.4,
        stars: 4,
        distance: '1.1 km from city center',
        tag: 'Design comfort',
        description: 'Minimal rooms, strong coffee, and excellent transport links in one of Berlins most walkable districts.',
        amenities: ['Free WiFi', 'Breakfast included', 'Air conditioning', 'Pet friendly'],
        image: 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1200&q=80',
        checkIn: '',
        checkOut: ''
      },
      {
        id: 8,
        name: 'Spreeview Residence',
        city: 'Berlin',
        pricePerNight: 168,
        rating: 4.7,
        stars: 4,
        distance: '0.8 km from city center',
        tag: 'River views',
        description: 'Contemporary rooms overlooking the Spree with a calm terrace and generous breakfast service.',
        amenities: ['Free WiFi', 'Parking', 'Breakfast included', 'Restaurant', 'Family rooms'],
        image: 'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1200&q=80',
        checkIn: '',
        checkOut: ''
      },
      {
        id: 9,
        name: 'Charlottenburg Maison',
        city: 'Berlin',
        pricePerNight: 128,
        rating: 4.2,
        stars: 3,
        distance: '3.4 km from city center',
        tag: 'Quiet rooms',
        description: 'A relaxed neighborhood hotel with bright rooms, friendly service, and easy access to western Berlin.',
        amenities: ['Free WiFi', 'Parking', 'Pet friendly', 'Air conditioning'],
        image: 'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1200&q=80',
        checkIn: '',
        checkOut: ''
      },
      {
        id: 10,
        name: 'Potsdamer Platz Suites',
        city: 'Berlin',
        pricePerNight: 215,
        rating: 4.8,
        stars: 5,
        distance: '0.3 km from city center',
        tag: 'Business favorite',
        description: 'Premium suites with skyline views, a strong business setup, and an elegant wellness floor.',
        amenities: ['Free WiFi', 'Gym', 'Spa', 'Business center', 'Restaurant'],
        image: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80',
        checkIn: '',
        checkOut: ''
      },
      {
        id: 11,
        name: 'Eixample Gold Hotel',
        city: 'Barcelona',
        pricePerNight: 176,
        rating: 4.5,
        stars: 4,
        distance: '0.7 km from city center',
        tag: 'Architectural charm',
        description: 'A refined Eixample stay with warm interiors, balcony rooms, and an easy walk to major sights.',
        amenities: ['Free WiFi', 'Pool', 'Breakfast included', 'Air conditioning'],
        image: 'https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=1200&q=80',
        checkIn: '',
        checkOut: ''
      },
      {
        id: 12,
        name: 'Gothic Quarter House',
        city: 'Barcelona',
        pricePerNight: 151,
        rating: 4.3,
        stars: 3,
        distance: '0.5 km from city center',
        tag: 'Old town base',
        description: 'Characterful rooms in a historic building with local dining, compact comfort, and central access.',
        amenities: ['Free WiFi', 'Restaurant', 'Air conditioning', 'Airport shuttle'],
        image: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80',
        checkIn: '',
        checkOut: ''
      },
      {
        id: 13,
        name: 'Marina Azul Resort',
        city: 'Barcelona',
        pricePerNight: 242,
        rating: 4.7,
        stars: 5,
        distance: '2.2 km from city center',
        tag: 'Pool terrace',
        description: 'A coastal luxury hotel with a rooftop pool, bright rooms, and smooth access to the waterfront.',
        amenities: ['Free WiFi', 'Pool', 'Spa', 'Gym', 'Restaurant'],
        image: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1200&q=80',
        checkIn: '',
        checkOut: ''
      },
      {
        id: 14,
        name: 'Passeig de Gracia Loft',
        city: 'Barcelona',
        pricePerNight: 198,
        rating: 4.6,
        stars: 4,
        distance: '0.4 km from city center',
        tag: 'Shopping district',
        description: 'Elegant loft-style rooms near boutiques, restaurants, and iconic modernist architecture.',
        amenities: ['Free WiFi', 'Breakfast included', 'Air conditioning', 'Family rooms'],
        image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80',
        checkIn: '',
        checkOut: ''
      },
      {
        id: 15,
        name: 'Montjuic Garden Inn',
        city: 'Barcelona',
        pricePerNight: 132,
        rating: 4.1,
        stars: 3,
        distance: '3.0 km from city center',
        tag: 'Green escape',
        description: 'A peaceful stay near gardens and museums with simple rooms and friendly neighborhood service.',
        amenities: ['Free WiFi', 'Parking', 'Pet friendly', 'Breakfast included'],
        image: 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1200&q=80',
        checkIn: '',
        checkOut: ''
      },
      {
        id: 16,
        name: 'Gran Via Royal',
        city: 'Madrid',
        pricePerNight: 205,
        rating: 4.6,
        stars: 5,
        distance: '0.3 km from city center',
        tag: 'Prime location',
        description: 'Classic Madrid elegance with spacious rooms, city views, and a polished restaurant.',
        amenities: ['Free WiFi', 'Gym', 'Restaurant', 'Air conditioning', 'Business center'],
        image: 'https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=1200&q=80',
        checkIn: '',
        checkOut: ''
      },
      {
        id: 17,
        name: 'Retiro Park Boutique',
        city: 'Madrid',
        pricePerNight: 162,
        rating: 4.5,
        stars: 4,
        distance: '1.4 km from city center',
        tag: 'Parkside calm',
        description: 'A calm boutique hotel near Retiro Park with soft rooms and a relaxed breakfast lounge.',
        amenities: ['Free WiFi', 'Breakfast included', 'Pet friendly', 'Family rooms'],
        image: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80',
        checkIn: '',
        checkOut: ''
      },
      {
        id: 18,
        name: 'Salamanca Suites',
        city: 'Madrid',
        pricePerNight: 234,
        rating: 4.8,
        stars: 5,
        distance: '1.1 km from city center',
        tag: 'Elegant suites',
        description: 'Upscale suites in Salamanca with refined service, premium bedding, and a discreet spa area.',
        amenities: ['Free WiFi', 'Spa', 'Gym', 'Parking', 'Airport shuttle'],
        image: 'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1200&q=80',
        checkIn: '',
        checkOut: ''
      },
      {
        id: 19,
        name: 'Plaza Mayor House',
        city: 'Madrid',
        pricePerNight: 119,
        rating: 4.2,
        stars: 3,
        distance: '0.6 km from city center',
        tag: 'Historic center',
        description: 'Comfortable rooms close to tapas bars, plazas, and cultural highlights in central Madrid.',
        amenities: ['Free WiFi', 'Air conditioning', 'Restaurant', 'Airport shuttle'],
        image: 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1200&q=80',
        checkIn: '',
        checkOut: ''
      },
      {
        id: 20,
        name: 'Chamartin Business Hotel',
        city: 'Madrid',
        pricePerNight: 146,
        rating: 4.3,
        stars: 4,
        distance: '3.6 km from city center',
        tag: 'Business smart',
        description: 'A practical premium hotel with large desks, quick station access, and reliable service.',
        amenities: ['Free WiFi', 'Parking', 'Gym', 'Business center', 'Restaurant'],
        image: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1200&q=80',
        checkIn: '',
        checkOut: ''
      },
      {
        id: 21,
        name: 'Saint-Germain Maison',
        city: 'Paris',
        pricePerNight: 265,
        rating: 4.7,
        stars: 5,
        distance: '0.8 km from city center',
        tag: 'Parisian classic',
        description: 'A refined Left Bank hotel with elegant rooms, quiet courtyards, and attentive service.',
        amenities: ['Free WiFi', 'Spa', 'Restaurant', 'Air conditioning', 'Airport shuttle'],
        image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80',
        checkIn: '',
        checkOut: ''
      },
      {
        id: 22,
        name: 'Le Marais Atelier',
        city: 'Paris',
        pricePerNight: 188,
        rating: 4.4,
        stars: 4,
        distance: '1.0 km from city center',
        tag: 'Boutique style',
        description: 'A stylish boutique stay with artful interiors, walkable streets, and a polished breakfast room.',
        amenities: ['Free WiFi', 'Breakfast included', 'Air conditioning', 'Pet friendly'],
        image: 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1200&q=80',
        checkIn: '',
        checkOut: ''
      },
      {
        id: 23,
        name: 'Opera Grand Hotel',
        city: 'Paris',
        pricePerNight: 224,
        rating: 4.6,
        stars: 4,
        distance: '0.5 km from city center',
        tag: 'Theater district',
        description: 'Polished rooms near the Opera with classic details, concierge support, and excellent dining nearby.',
        amenities: ['Free WiFi', 'Gym', 'Restaurant', 'Business center'],
        image: 'https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=1200&q=80',
        checkIn: '',
        checkOut: ''
      },
      {
        id: 24,
        name: 'Montmartre View Inn',
        city: 'Paris',
        pricePerNight: 142,
        rating: 4.2,
        stars: 3,
        distance: '3.2 km from city center',
        tag: 'Village charm',
        description: 'A charming hillside stay with warm rooms, local cafes, and easy access to metro lines.',
        amenities: ['Free WiFi', 'Breakfast included', 'Family rooms', 'Pet friendly'],
        image: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80',
        checkIn: '',
        checkOut: ''
      },
      {
        id: 25,
        name: 'Trocadero Luxe Suites',
        city: 'Paris',
        pricePerNight: 315,
        rating: 4.8,
        stars: 5,
        distance: '2.0 km from city center',
        tag: 'Landmark views',
        description: 'Premium suites with refined finishes, optional skyline views, and a serene spa experience.',
        amenities: ['Free WiFi', 'Spa', 'Parking', 'Restaurant', 'Air conditioning'],
        image: 'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1200&q=80',
        checkIn: '',
        checkOut: ''
      },
      {
        id: 26,
        name: 'Duomo Milano Palace',
        city: 'Mailand',
        pricePerNight: 238,
        rating: 4.7,
        stars: 5,
        distance: '0.4 km from city center',
        tag: 'Duomo nearby',
        description: 'A sophisticated central hotel with sleek rooms, excellent aperitivo service, and premium shopping nearby.',
        amenities: ['Free WiFi', 'Spa', 'Gym', 'Restaurant', 'Air conditioning'],
        image: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1200&q=80',
        checkIn: '',
        checkOut: ''
      },
      {
        id: 27,
        name: 'Brera Design House',
        city: 'Mailand',
        pricePerNight: 181,
        rating: 4.5,
        stars: 4,
        distance: '0.9 km from city center',
        tag: 'Design district',
        description: 'A stylish Brera stay with curated interiors, quiet rooms, and walkable galleries.',
        amenities: ['Free WiFi', 'Breakfast included', 'Pet friendly', 'Air conditioning'],
        image: 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1200&q=80',
        checkIn: '',
        checkOut: ''
      },
      {
        id: 28,
        name: 'Navigli Canal Hotel',
        city: 'Mailand',
        pricePerNight: 149,
        rating: 4.3,
        stars: 3,
        distance: '2.4 km from city center',
        tag: 'Local favorite',
        description: 'Comfortable rooms near canals, nightlife, and relaxed restaurants with friendly service.',
        amenities: ['Free WiFi', 'Restaurant', 'Airport shuttle', 'Family rooms'],
        image: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80',
        checkIn: '',
        checkOut: ''
      },
      {
        id: 29,
        name: 'Porta Nuova Executive',
        city: 'Mailand',
        pricePerNight: 206,
        rating: 4.6,
        stars: 4,
        distance: '1.5 km from city center',
        tag: 'Business center',
        description: 'Modern business-focused rooms with skyline access, fast WiFi, and polished meeting facilities.',
        amenities: ['Free WiFi', 'Gym', 'Business center', 'Parking', 'Restaurant'],
        image: 'https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=1200&q=80',
        checkIn: '',
        checkOut: ''
      },
      {
        id: 30,
        name: 'Scala Boutique Suites',
        city: 'Mailand',
        pricePerNight: 219,
        rating: 4.8,
        stars: 5,
        distance: '0.6 km from city center',
        tag: 'Cultural stay',
        description: 'Elegant suites close to theaters and boutiques with quiet service and refined evening dining.',
        amenities: ['Free WiFi', 'Spa', 'Breakfast included', 'Air conditioning', 'Airport shuttle'],
        image: 'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1200&q=80',
        checkIn: '',
        checkOut: ''
      },
      {
        id: 31,
        name: 'Colosseum Crown Hotel',
        city: 'Rom',
        pricePerNight: 221,
        rating: 4.7,
        stars: 5,
        distance: '0.7 km from city center',
        tag: 'Historic views',
        description: 'A refined Roman stay with classic interiors, rooftop dining, and easy access to ancient landmarks.',
        amenities: ['Free WiFi', 'Restaurant', 'Spa', 'Air conditioning', 'Airport shuttle'],
        image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80',
        checkIn: '',
        checkOut: ''
      },
      {
        id: 32,
        name: 'Trastevere Garden Inn',
        city: 'Rom',
        pricePerNight: 136,
        rating: 4.2,
        stars: 3,
        distance: '1.9 km from city center',
        tag: 'Neighborhood charm',
        description: 'A relaxed hotel with garden seating, warm rooms, and easy walks to local trattorias.',
        amenities: ['Free WiFi', 'Breakfast included', 'Pet friendly', 'Family rooms'],
        image: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80',
        checkIn: '',
        checkOut: ''
      },
      {
        id: 33,
        name: 'Via Veneto Grand',
        city: 'Rom',
        pricePerNight: 256,
        rating: 4.8,
        stars: 5,
        distance: '0.9 km from city center',
        tag: 'Grand classic',
        description: 'Old-world luxury with attentive service, spacious rooms, and a calm wellness area.',
        amenities: ['Free WiFi', 'Spa', 'Gym', 'Restaurant', 'Business center'],
        image: 'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1200&q=80',
        checkIn: '',
        checkOut: ''
      },
      {
        id: 34,
        name: 'Prati City Rooms',
        city: 'Rom',
        pricePerNight: 158,
        rating: 4.4,
        stars: 4,
        distance: '2.3 km from city center',
        tag: 'Quiet district',
        description: 'Smart rooms in a calmer district with strong transport links and reliable business amenities.',
        amenities: ['Free WiFi', 'Parking', 'Air conditioning', 'Business center'],
        image: 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1200&q=80',
        checkIn: '',
        checkOut: ''
      },
      {
        id: 35,
        name: 'Piazza Navona Residence',
        city: 'Rom',
        pricePerNight: 184,
        rating: 4.5,
        stars: 4,
        distance: '0.5 km from city center',
        tag: 'Central romance',
        description: 'Elegant rooms near piazzas, galleries, and restaurants with a refined boutique atmosphere.',
        amenities: ['Free WiFi', 'Breakfast included', 'Restaurant', 'Airport shuttle'],
        image: 'https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=1200&q=80',
        checkIn: '',
        checkOut: ''
      },
      {
        id: 36,
        name: 'Funchal Ocean Retreat',
        city: 'Madera',
        pricePerNight: 172,
        rating: 4.6,
        stars: 4,
        distance: '1.2 km from city center',
        tag: 'Ocean breeze',
        description: 'Bright rooms with Atlantic views, a relaxed pool deck, and easy access to Funchal promenades.',
        amenities: ['Free WiFi', 'Pool', 'Breakfast included', 'Air conditioning'],
        image: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1200&q=80',
        checkIn: '',
        checkOut: ''
      },
      {
        id: 37,
        name: 'Madeira Cliffside Spa',
        city: 'Madera',
        pricePerNight: 244,
        rating: 4.8,
        stars: 5,
        distance: '2.8 km from city center',
        tag: 'Wellness escape',
        description: 'A serene cliffside resort with spa rituals, sea-facing rooms, and calm terraces.',
        amenities: ['Free WiFi', 'Spa', 'Pool', 'Gym', 'Restaurant'],
        image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80',
        checkIn: '',
        checkOut: ''
      },
      {
        id: 38,
        name: 'Old Town Funchal House',
        city: 'Madera',
        pricePerNight: 118,
        rating: 4.2,
        stars: 3,
        distance: '0.6 km from city center',
        tag: 'Old town stay',
        description: 'A friendly central hotel close to markets, restaurants, and the waterfront.',
        amenities: ['Free WiFi', 'Airport shuttle', 'Family rooms', 'Breakfast included'],
        image: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80',
        checkIn: '',
        checkOut: ''
      },
      {
        id: 39,
        name: 'Laurissilva Garden Resort',
        city: 'Madera',
        pricePerNight: 156,
        rating: 4.4,
        stars: 4,
        distance: '3.5 km from city center',
        tag: 'Nature base',
        description: 'A quiet resort surrounded by gardens with comfortable rooms and access to hiking routes.',
        amenities: ['Free WiFi', 'Parking', 'Pool', 'Pet friendly', 'Restaurant'],
        image: 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1200&q=80',
        checkIn: '',
        checkOut: ''
      },
      {
        id: 40,
        name: 'Atlantic Business Suites',
        city: 'Madera',
        pricePerNight: 189,
        rating: 4.5,
        stars: 4,
        distance: '1.7 km from city center',
        tag: 'Work and sea',
        description: 'Modern suites with workspace, sea air, and smooth airport access for longer stays.',
        amenities: ['Free WiFi', 'Business center', 'Airport shuttle', 'Air conditioning', 'Gym'],
        image: 'https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=1200&q=80',
        checkIn: '',
        checkOut: ''
      },
      {
        id: 41,
        name: 'Danube Crown Hotel',
        city: 'Budapest',
        pricePerNight: 158,
        rating: 4.6,
        stars: 5,
        distance: '0.7 km from city center',
        tag: 'River elegance',
        description: 'A refined riverside hotel with classic rooms, excellent dining, and views toward the Danube.',
        amenities: ['Free WiFi', 'Spa', 'Restaurant', 'Air conditioning', 'Airport shuttle'],
        image: 'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1200&q=80',
        checkIn: '',
        checkOut: ''
      },
      {
        id: 42,
        name: 'Buda Castle Rooms',
        city: 'Budapest',
        pricePerNight: 126,
        rating: 4.4,
        stars: 4,
        distance: '1.8 km from city center',
        tag: 'Castle district',
        description: 'Comfortable rooms near historic streets, viewpoints, and relaxed cafes.',
        amenities: ['Free WiFi', 'Breakfast included', 'Parking', 'Family rooms'],
        image: 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1200&q=80',
        checkIn: '',
        checkOut: ''
      },
      {
        id: 43,
        name: 'Pest Urban Hotel',
        city: 'Budapest',
        pricePerNight: 98,
        rating: 4.1,
        stars: 3,
        distance: '0.9 km from city center',
        tag: 'Smart central',
        description: 'A modern value hotel with practical rooms, local nightlife nearby, and fast city access.',
        amenities: ['Free WiFi', 'Air conditioning', 'Pet friendly', 'Airport shuttle'],
        image: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80',
        checkIn: '',
        checkOut: ''
      },
      {
        id: 44,
        name: 'Thermal Spa Grand',
        city: 'Budapest',
        pricePerNight: 184,
        rating: 4.7,
        stars: 5,
        distance: '2.5 km from city center',
        tag: 'Spa favorite',
        description: 'A wellness-focused grand hotel with thermal-inspired spa facilities and elegant rooms.',
        amenities: ['Free WiFi', 'Spa', 'Pool', 'Gym', 'Restaurant'],
        image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80',
        checkIn: '',
        checkOut: ''
      },
      {
        id: 45,
        name: 'Andrassy Boutique',
        city: 'Budapest',
        pricePerNight: 132,
        rating: 4.5,
        stars: 4,
        distance: '0.6 km from city center',
        tag: 'Boutique avenue',
        description: 'A polished boutique hotel near cultural venues, cafes, and elegant avenue shopping.',
        amenities: ['Free WiFi', 'Breakfast included', 'Business center', 'Air conditioning'],
        image: 'https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=1200&q=80',
        checkIn: '',
        checkOut: ''
      },
      {
        id: 46,
        name: 'Ringstrasse Imperial',
        city: 'Wien',
        pricePerNight: 236,
        rating: 4.8,
        stars: 5,
        distance: '0.5 km from city center',
        tag: 'Imperial luxury',
        description: 'A grand Vienna hotel with elegant rooms, polished service, and landmark access along the Ringstrasse.',
        amenities: ['Free WiFi', 'Spa', 'Restaurant', 'Gym', 'Business center'],
        image: 'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1200&q=80',
        checkIn: '',
        checkOut: ''
      },
      {
        id: 47,
        name: 'Stephansplatz Residence',
        city: 'Wien',
        pricePerNight: 194,
        rating: 4.6,
        stars: 4,
        distance: '0.3 km from city center',
        tag: 'Cathedral nearby',
        description: 'Elegant central rooms with quiet windows, boutique service, and easy access to old-town streets.',
        amenities: ['Free WiFi', 'Breakfast included', 'Air conditioning', 'Airport shuttle'],
        image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80',
        checkIn: '',
        checkOut: ''
      },
      {
        id: 48,
        name: 'Naschmarkt Urban Inn',
        city: 'Wien',
        pricePerNight: 124,
        rating: 4.2,
        stars: 3,
        distance: '1.5 km from city center',
        tag: 'Market access',
        description: 'A comfortable stay near food markets, museums, and public transport with practical rooms.',
        amenities: ['Free WiFi', 'Pet friendly', 'Family rooms', 'Air conditioning'],
        image: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80',
        checkIn: '',
        checkOut: ''
      },
      {
        id: 49,
        name: 'Schonbrunn Garden Hotel',
        city: 'Wien',
        pricePerNight: 148,
        rating: 4.4,
        stars: 4,
        distance: '3.2 km from city center',
        tag: 'Garden calm',
        description: 'A quiet hotel near palace gardens with warm rooms, parking, and family-friendly service.',
        amenities: ['Free WiFi', 'Parking', 'Breakfast included', 'Family rooms', 'Restaurant'],
        image: 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1200&q=80',
        checkIn: '',
        checkOut: ''
      },
      {
        id: 50,
        name: 'Belvedere Art Suites',
        city: 'Wien',
        pricePerNight: 172,
        rating: 4.5,
        stars: 4,
        distance: '1.2 km from city center',
        tag: 'Artful stay',
        description: 'Modern suites close to galleries and gardens with workspace, calm styling, and refined service.',
        amenities: ['Free WiFi', 'Gym', 'Business center', 'Air conditioning', 'Restaurant'],
        image: 'https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=1200&q=80',
        checkIn: '',
        checkOut: ''
      }
    ];
  }
}
