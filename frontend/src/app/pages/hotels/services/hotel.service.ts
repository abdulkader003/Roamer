import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class HotelService {

  constructor(private http: HttpClient) {}

  searchHotels(location: string, checkIn: string, checkOut: string) {
    return this.http.get('/api/hotels', {
      params: {
        location,
        checkIn,
        checkOut
      }
    });
  }
}
