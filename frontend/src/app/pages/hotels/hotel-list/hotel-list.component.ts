
import { Component, Input } from '@angular/core';
import { CalendarEvent, Hotel, HotelSort } from '../models/hotel.model';
import { CalendarService } from '../services/calendar.service';

@Component({
  selector: 'app-hotel-list',
  standalone: true,
  imports: [],
  templateUrl: './hotel-list.component.html',
  styleUrls: ['./hotel-list.component.css']
})
export class HotelListComponent {
  private currentHotels: Hotel[] = [];

  @Input() set hotels(value: Hotel[]) {
    this.currentHotels = value ?? [];
    this.applySort();
  }

  displayedHotels: Hotel[] = [];
  selectedHotel: Hotel | null = null;
  selectedSort: HotelSort = 'recommended';
  calendarMessage = '';
  currentImageIndex = 0;

  constructor(private calendarService: CalendarService) {}

  sortHotels(type: HotelSort) {
    this.selectedSort = type;
    this.applySort();
  }

  selectHotel(hotel: Hotel) {
    this.selectedHotel = hotel;
    this.calendarMessage = '';
    this.currentImageIndex = 0;
  }

  closeModal() {
    this.selectedHotel = null;
  }

  get modalImages(): string[] {
    if (!this.selectedHotel) {
      return [];
    }

    const images = this.selectedHotel.images?.filter(Boolean) ?? [];

    if (images.length) {
      return images;
    }

    return this.selectedHotel.image ? [this.selectedHotel.image] : [];
  }

  get modalImageCounter(): string {
    return `${this.currentImageIndex + 1} / ${this.modalImages.length || 1}`;
  }

  previousModalImage(event: Event) {
    event.stopPropagation();
    const imageCount = this.modalImages.length;

    if (imageCount <= 1) {
      return;
    }

    this.currentImageIndex = (this.currentImageIndex - 1 + imageCount) % imageCount;
  }

  nextModalImage(event: Event) {
    event.stopPropagation();
    const imageCount = this.modalImages.length;

    if (imageCount <= 1) {
      return;
    }

    this.currentImageIndex = (this.currentImageIndex + 1) % imageCount;
  }

  addToCalendar() {
    if (!this.selectedHotel) {
      return;
    }

    const stayDetails = this.getStayDetails(this.selectedHotel);

    if (!stayDetails) {
      this.calendarMessage = 'Please select valid check-in and check-out dates first.';
      return;
    }

    const event: CalendarEvent = {
      title: this.selectedHotel.name,
      startDate: this.selectedHotel.checkIn,
      endDate: this.selectedHotel.checkOut,
      price: stayDetails.totalPrice,
      description: this.buildCalendarDescription(this.selectedHotel, stayDetails)
    };

    this.calendarService.addEvent(event);
    this.calendarMessage = 'Added to calendar';
  }

  trackByHotelId(_index: number, hotel: Hotel) {
    return hotel.id;
  }

  get totalNightsLabel(): string {
    if (!this.selectedHotel) {
      return 'Selected stay';
    }

    const stayDetails = this.getStayDetails(this.selectedHotel);

    if (!stayDetails) {
      return 'Select dates';
    }

    return this.formatGuestStay(stayDetails);
  }

  getStayDetails(hotel: Hotel): { nights: number; adults: number; children: number; totalPrice: number } | null {
    const checkIn = this.parseDate(hotel.checkIn);
    const checkOut = this.parseDate(hotel.checkOut);

    if (!checkIn || !checkOut) {
      return null;
    }

    const nights = Math.round((checkOut.getTime() - checkIn.getTime()) / 86400000);

    if (nights <= 0) {
      return null;
    }

    return {
      nights,
      adults: hotel.adults ?? 2,
      children: hotel.children ?? 0,
      totalPrice: Math.round(hotel.pricePerNight * nights)
    };
  }

  formatTotalPrice(hotel: Hotel): string {
    const stayDetails = this.getStayDetails(hotel);

    if (!stayDetails) {
      return 'Select dates to see total price';
    }

    return `€${stayDetails.totalPrice.toLocaleString('en-US')}`;
  }

  formatStayDetails(hotel: Hotel): string {
    const stayDetails = this.getStayDetails(hotel);

    if (!stayDetails) {
      return this.formatGuests(hotel.adults ?? 2, hotel.children ?? 0);
    }

    return this.formatGuestStay(stayDetails);
  }

  getDistanceLabel(hotel: Hotel): string {
    return `${hotel.city}: ${hotel.distanceFromCenter ?? hotel.distance}`;
  }

  getRatingScore(hotel: Hotel): string {
    return `${hotel.ratingScore ?? Number((hotel.rating * 2).toFixed(1))}`;
  }

  getRatingLabel(hotel: Hotel): string {
    if (hotel.ratingLabel) {
      return hotel.ratingLabel;
    }

    const score = Number(this.getRatingScore(hotel));

    if (score >= 9) {
      return 'Superb';
    }

    if (score >= 8) {
      return 'Fabulous';
    }

    return 'Very good';
  }

  getReviewCount(hotel: Hotel): number {
    return hotel.reviewCount ?? 24 + hotel.id * 4;
  }

  getKeyAmenities(hotel: Hotel): string[] {
    return hotel.amenities?.slice(0, 4) ?? [];
  }

  private applySort() {
    let sortedHotels = [...this.currentHotels];

    switch (this.selectedSort) {
      case 'price':
        sortedHotels = sortedHotels.sort((a, b) => a.pricePerNight - b.pricePerNight);
        break;
      case 'rating':
        sortedHotels = sortedHotels.sort((a, b) => b.rating - a.rating);
        break;
      case 'stars':
        sortedHotels = sortedHotels.sort((a, b) => b.stars - a.stars);
        break;
      default:
        break;
    }

    this.displayedHotels = sortedHotels;
  }

  private parseDate(value: string): Date | null {
    if (!value) {
      return null;
    }

    const [year, month, day] = value.split('-').map(Number);

    if (!year || !month || !day) {
      return null;
    }

    const date = new Date(year, month - 1, day);

    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
      return null;
    }

    return date;
  }

  private buildCalendarDescription(
    hotel: Hotel,
    stayDetails: { nights: number; adults: number; children: number; totalPrice: number }
  ): string {
    return [
      `Hotel name: ${hotel.name}`,
      `Check-in: ${hotel.checkIn}`,
      `Check-out: ${hotel.checkOut}`,
      `Nights: ${stayDetails.nights}`,
      `Adults: ${stayDetails.adults}`,
      `Children: ${stayDetails.children}`,
      `Price per night: ${hotel.pricePerNight} EUR`,
      `Total price: ${stayDetails.totalPrice} EUR`,
      'Includes taxes and fees',
      `Amenities: ${hotel.amenities?.length ? hotel.amenities.join(', ') : 'Not specified'}`
    ].join('\n');
  }

  private formatGuestStay(stayDetails: { nights: number; adults: number; children: number }): string {
    return `${stayDetails.nights} ${stayDetails.nights === 1 ? 'night' : 'nights'}, ${this.formatGuests(stayDetails.adults, stayDetails.children)}`;
  }

  private formatGuests(adults: number, children: number): string {
    const adultLabel = `${adults} ${adults === 1 ? 'adult' : 'adults'}`;
    const childLabel = `${children} ${children === 1 ? 'child' : 'children'}`;

    return `${adultLabel}, ${childLabel}`;
  }
}
