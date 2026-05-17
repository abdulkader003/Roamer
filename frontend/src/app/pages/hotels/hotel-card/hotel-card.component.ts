import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { CalendarService } from '../services/calendar.service';
import { CalendarEvent, Hotel } from '../models/hotel.model';

//standalone: true,

@Component({
  selector: 'app-hotel-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './hotel-card.component.html',
  styleUrls: ['./hotel-card.component.css']
})
export class HotelCardComponent {

  private selectedHotel!: Hotel;

  @Input() set hotel(value: Hotel) {
    this.selectedHotel = value;
    this.currentImageIndex = 0;
  }

  get hotel(): Hotel {
    return this.selectedHotel;
  }

  errorMessage = '';
  currentImageIndex = 0;

  constructor(
    private calendarService: CalendarService,
  ) {}

  get numberOfNights(): number | null {
    return this.stayDetails?.nights ?? null;
  }

  get totalPrice(): number | null {
    return this.stayDetails?.totalPrice ?? null;
  }

  get formattedTotalPrice(): string {
    return this.totalPrice ? `${this.totalPrice.toLocaleString('en-US')} EUR` : 'Select dates to see total price';
  }

  get visibleAmenities(): string[] {
    return this.hotel.amenities?.slice(0, 8) ?? [];
  }

  get hiddenAmenitiesCount(): number {
    const amenitiesCount = this.hotel.amenities?.length ?? 0;

    return Math.max(0, amenitiesCount - this.visibleAmenities.length);
  }

  get cardImages(): string[] {
    const images = this.hotel.images?.filter(Boolean) ?? [];

    if (images.length) {
      return images;
    }

    return this.hotel.image ? [this.hotel.image] : [];
  }

  get imageCounter(): string {
    return `${this.currentImageIndex + 1} / ${this.cardImages.length || 1}`;
  }

  previousImage(event: Event) {
    event.stopPropagation();
    const imageCount = this.cardImages.length;

    if (imageCount <= 1) {
      return;
    }

    this.currentImageIndex = (this.currentImageIndex - 1 + imageCount) % imageCount;
  }

  nextImage(event: Event) {
    event.stopPropagation();
    const imageCount = this.cardImages.length;

    if (imageCount <= 1) {
      return;
    }

    this.currentImageIndex = (this.currentImageIndex + 1) % imageCount;
  }

  selectImage(index: number, event: Event) {
    event.stopPropagation();
    this.currentImageIndex = index;
  }

  async addToCalendar() {
    const stayDetails = this.stayDetails;

    if (!stayDetails) {
      this.errorMessage = 'Please select valid check-in and check-out dates first.';
      return;
    }

    this.errorMessage = '';

    const event: CalendarEvent = {
      title: this.hotel.name,
      startDate: this.hotel.checkIn,
      endDate: this.hotel.checkOut,
      price: stayDetails.totalPrice,
      location: this.hotel.city,
      category: 'Hotel',
      description: this.buildEventDescription(stayDetails)
    };

    try {
      const result = await this.calendarService.addEventOrRedirectToLogin(event);
      this.errorMessage = result === 'added'
        ? 'Added to calendar'
        : 'Continue with login to save this stay to your calendar.';
    } catch (error) {
      console.error('Error adding hotel stay to calendar:', error);
      this.errorMessage = 'Unable to add this stay to the calendar right now.';
    }
  }

  private get stayDetails(): { nights: number; totalPrice: number } | null {
    const checkIn = this.parseDate(this.hotel?.checkIn);
    const checkOut = this.parseDate(this.hotel?.checkOut);

    if (!checkIn || !checkOut) {
      return null;
    }

    const millisecondsPerDay = 24 * 60 * 60 * 1000;
    const nights = Math.round((checkOut.getTime() - checkIn.getTime()) / millisecondsPerDay);

    if (nights <= 0) {
      return null;
    }

    return {
      nights,
      totalPrice: this.hotel.pricePerNight * nights
    };
  }

  private buildEventDescription(stayDetails: { nights: number; totalPrice: number }): string {
    const amenities = this.hotel.amenities?.length ? this.hotel.amenities.join(', ') : 'Not specified';

    return [
      `Hotel: ${this.hotel.name}`,
      `Check-in: ${this.hotel.checkIn}`,
      `Check-out: ${this.hotel.checkOut}`,
      `Nights: ${stayDetails.nights}`,
      `Price per night: ${this.hotel.pricePerNight} EUR`,
      `Total price: ${stayDetails.totalPrice} EUR`,
      `Amenities: ${amenities}`
    ].join('\n');
  }

  private parseDate(value?: string): Date | null {
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
}
