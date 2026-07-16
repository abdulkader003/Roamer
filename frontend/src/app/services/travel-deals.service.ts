import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of, tap } from 'rxjs';
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
  private cachedDeals: TravelDeal[] | null = null;

  getDeals(forceRefresh = false): Observable<TravelDeal[]> {
    if (!forceRefresh && this.cachedDeals) {
      return of(this.cachedDeals);
    }

    return this.http.get<TravelDeal[]>(this.apiUrl, {
      headers: this.authService.authHeader(),
      params: forceRefresh ? { refreshKey: this.createRefreshKey() } : {},
    }).pipe(tap((deals) => this.cachedDeals = deals));
  }

  private createRefreshKey(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}
