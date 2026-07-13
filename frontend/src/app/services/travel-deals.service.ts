import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AuthService } from './auth';

export type TravelDealType = 'FLIGHT' | 'HOTEL' | 'ACTIVITY';

export interface TravelDeal {
  id: string;
  type: TravelDealType;
  title: string;
  origin: string | null;
  destination: string;
  price: number;
  currency: string;
  provider: string;
  description: string;
  actionLabel: string;
  actionRoute: string;
}

@Injectable({
  providedIn: 'root',
})
export class TravelDealsService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly apiUrl = '/api/travel-deals';

  getDeals(): Observable<TravelDeal[]> {
    return this.http.get<TravelDeal[]>(this.apiUrl, {
      headers: this.authService.authHeader(),
    });
  }
}
