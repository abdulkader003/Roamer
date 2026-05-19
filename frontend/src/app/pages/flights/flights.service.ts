import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Flight, SearchParams } from './flight.model';

export interface FlightResponse {
  searchId: number;
  tripType: SearchParams['tripType'];
  from: SearchParams['from'];
  to: SearchParams['to'];
  departureDate: string;
  returnDate: string | null;
  multiCitySegments: Array<{
    fromText: string;
    toText: string;
    date: string | null;
  }>;
  travelers: number;
  adults: number;
  children: number;
  cabinClass: SearchParams['cabinClass'];
  outboundFlights: Flight[];
  returnFlights: Flight[];
  segmentFlights: Array<{
    segmentIndex: number;
    fromText: string;
    toText: string;
    date: string;
    flights: Flight[];
  }>;
  flights: Flight[];
}

@Injectable({
  providedIn: 'root',
})
export class FlightsService {
  private readonly apiUrl = 'http://localhost:8080/api/flights';

  constructor(private readonly http: HttpClient) {}

  search(params: SearchParams): Observable<FlightResponse> {
    return this.http.post<FlightResponse>(this.apiUrl, this.toBackendRequest(params));
  }

  private toBackendRequest(params: SearchParams) {
    return {
      ...params,
      departureDate: this.formatDate(params.departureDate),
      returnDate: this.formatDate(params.returnDate),
      multiCitySegments: params.multiCitySegments?.map((segment) => ({
        ...segment,
        date: this.formatDate(segment.date),
      })),
    };
  }

  private formatDate(date: Date | null): string | null {
    if (!date) {
      return null;
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }
}
