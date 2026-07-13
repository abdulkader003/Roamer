import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal, computed } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TravelDeal, TravelDealsService, TravelDealType } from '../../services/travel-deals.service';

type TravelDealFilter = 'ALL' | TravelDealType;

@Component({
  selector: 'app-travel-deals',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './travel-deals.component.html',
  styleUrl: './travel-deals.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TravelDealsComponent {
  private readonly travelDealsService = inject(TravelDealsService);
  private readonly router = inject(Router);

  readonly isLoading = signal(true);
  readonly error = signal('');
  readonly deals = signal<TravelDeal[]>([]);
  readonly selectedFilter = signal<TravelDealFilter>('ALL');
  readonly filters: TravelDealFilter[] = ['ALL', 'FLIGHT', 'HOTEL', 'ACTIVITY'];
  readonly filteredDeals = computed(() => {
    const filter = this.selectedFilter();
    return filter === 'ALL'
      ? this.deals()
      : this.deals().filter((deal) => deal.type === filter);
  });

  constructor() {
    this.loadDeals();
  }

  loadDeals(): void {
    this.isLoading.set(true);
    this.error.set('');

    this.travelDealsService.getDeals().subscribe({
      next: (deals) => {
        this.deals.set(deals);
        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('Failed to load travel deals:', error);
        this.deals.set([]);
        this.error.set('Travel deals are unavailable right now.');
        this.isLoading.set(false);
      }
    });
  }

  selectFilter(filter: TravelDealFilter): void {
    this.selectedFilter.set(filter);
  }

  openDeal(deal: TravelDeal): void {
    void this.router.navigateByUrl(deal.actionRoute);
  }

  formatDealPrice(deal: TravelDeal): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: deal.currency || 'EUR',
      maximumFractionDigits: 0,
    }).format(deal.price ?? 0);
  }
}
