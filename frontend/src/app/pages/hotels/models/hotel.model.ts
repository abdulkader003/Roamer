export interface Hotel {
  id: number;
  name: string;
  city: string;
  pricePerNight: number;
  rating: number;
  ratingScore?: number;
  ratingLabel?: string;
  reviewCount?: number;
  stars: number;
  checkIn: string;
  checkOut: string;
  distance: string;
  distanceFromCenter?: string;
  tag: string;
  description: string;
  amenities: string[];
  adults?: number;
  children?: number;
  image: string;
  images?: string[];
}

export type HotelSort = 'recommended' | 'rating' | 'price' | 'stars';

export interface CalendarEvent {
  title: string;
  startDate: string;
  endDate: string;
  price: number;
  location?: string;
  category?: string;
  notes?: string;
  startTime?: string;
  endTime?: string;
  description?: string;
}
