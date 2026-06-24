import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AuthService } from './auth';

export interface BudgetSummaryResponse {
  totalBudget: number;
  totalSpent: number;
  remainingBalance: number;
  usagePercentage: number;
}

export interface BudgetCategoryResponse {
  category: string;
  spent: number;
  budget: number;
  percentage: number;
  isNearLimit?: boolean;
  nearLimit?: boolean;
  isOverLimit?: boolean;
  overLimit?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class BudgetApiService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly apiUrl = '/api/budget';

  getSummary(): Observable<BudgetSummaryResponse> {
    return this.http.get<BudgetSummaryResponse>(`${this.apiUrl}/summary`, {
      headers: this.authHeader(),
    });
  }

  getCategoryBudgets(): Observable<BudgetCategoryResponse[]> {
    return this.http.get<BudgetCategoryResponse[]>(`${this.apiUrl}/categories`, {
      headers: this.authHeader(),
    });
  }

  private authHeader(): Record<string, string> {
    return this.authService.authHeader();
  }
}
