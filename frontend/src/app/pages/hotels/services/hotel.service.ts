import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Hotel } from '../models/hotel.model';

@Injectable({
  providedIn: 'root'
})
export class HotelService {

  constructor(private http: HttpClient) {}

  searchHotels(location: string, checkIn: string, checkOut: string, adults: number, children: number): Observable<Hotel[]> {
    return this.http.get<Hotel[]>('/api/hotels', {
      params: {
        location,
        checkIn,
        checkOut,
        adults,
        children
      }
    });
  }
}
