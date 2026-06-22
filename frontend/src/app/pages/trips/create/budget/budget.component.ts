import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  CreateTripBudgetRequest,
  TripPlanningService,
} from '../../../../services/trip-planning.service';
import { TripTempService } from '../trip-temp.service';

type TravelStyle = 'budget' | 'mid-range' | 'luxury';

interface TravelStyleOption {
  id: TravelStyle;
  title: string;
  description: string;
  icon: string;
  ratePerNight: number;
}

interface TripStep {
  label: string;
  route?: string;
}

@Component({
  selector: 'app-budget',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './budget.component.html',
  styleUrl: './budget.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BudgetComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly tripPlanningService = inject(TripPlanningService);
  private readonly tripTempService = inject(TripTempService);


  readonly steps: TripStep[] = [
    { label: 'Budget', route: '/trips/create/budget' },
    { label: 'Destination', route: '/trips/create/destination' },
    { label: 'Flights', route: '/trips/create/flights' },
    { label: 'Hotels', route: '/trips/create/hotels' },
    { label: 'Activities', route: '/trips/create/activities' },
    { label: 'Overview', route: '/trips/create/overview' },
  ];
  readonly selectedTravelStyle = signal<TravelStyle>('mid-range');
  readonly recommendedBudget = signal(0);
  readonly recommendationUpdated = signal(false);
  readonly isSaving = signal(false);
  readonly saveError = signal('');
  readonly savedTripPlanningId = signal<number | null>(null);
  private recommendationAnimationTimer?: ReturnType<typeof setTimeout>;

  readonly travelStyles: TravelStyleOption[] = [
    {
      id: 'budget',
      title: 'Budget',
      description: 'Smart choices and great value',
      icon: '€',
      ratePerNight: 250,
    },
    {
      id: 'mid-range',
      title: 'Mid-range',
      description: 'Comfort with room to explore',
      icon: '€€',
      ratePerNight: 350,
    },
    {
      id: 'luxury',
      title: 'Luxury',
      description: 'Premium stays and experiences',
      icon: '€€€',
      ratePerNight: 900,
    },
  ];

  readonly budgetForm = this.formBuilder.nonNullable.group({
    tripName: ['', [Validators.required, Validators.pattern(/\S/)]],
    totalBudget: [0, [Validators.required, Validators.min(1)]],
    currency: ['EUR'],
    nights: [0, [Validators.min(1)]],
  });

  ngOnInit(): void {
    this.restoreBudgetDraft();
  }

  budgetPerNight(): number {
    const budget = Number(this.budgetForm.controls.totalBudget.value) || 0;
    const nights = this.budgetForm.controls.nights.value || 1;
    return Math.round(budget / nights);
  }

  adjustNights(change: number): void {
    const nights = Math.max(0, this.budgetForm.controls.nights.value + change);
    this.budgetForm.controls.nights.setValue(nights);
    this.applyRecommendedBudget();
  }

  updateDuration(event: Event): void {
    const input = event.target as HTMLInputElement;
    const nights = Math.max(0, Math.floor(Number(input.value) || 0));

    this.budgetForm.controls.nights.setValue(nights);
    input.value = String(nights);
    this.applyRecommendedBudget();
  }

  preventInvalidBudgetKey(event: KeyboardEvent): void {
    if (['-', '+', 'e', 'E'].includes(event.key)) {
      event.preventDefault();
    }
  }

  validateBudgetInput(event: Event): void {
    const input = event.target as HTMLInputElement;

    // Prevents pasted negative values while keeping an invalid empty field editable.
    if (input.valueAsNumber < 0) {
      input.value = '';
      this.budgetForm.controls.totalBudget.setValue(0);
    }
  }

  selectTravelStyle(style: TravelStyle): void {
    this.selectedTravelStyle.set(style);
    this.applyRecommendedBudget();
  }

  selectedTravelStyleTitle(): string {
    return this.travelStyles.find((style) => style.id === this.selectedTravelStyle())?.title ?? '';
  }

  formatRecommendedBudget(): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(this.recommendedBudget());
  }

  private applyRecommendedBudget(): void {
    const selectedStyle = this.travelStyles.find(
      (style) => style.id === this.selectedTravelStyle(),
    );
    const recommendation = (selectedStyle?.ratePerNight ?? 0) * this.budgetForm.controls.nights.value;

    // Calculates visual recommendation without changing the user's manual budget.
    this.recommendedBudget.set(recommendation);
    this.recommendationUpdated.set(false);

    clearTimeout(this.recommendationAnimationTimer);
    requestAnimationFrame(() => this.recommendationUpdated.set(true));
    this.recommendationAnimationTimer = setTimeout(
      () => this.recommendationUpdated.set(false),
      900,
    );
  }

  recommendedFlowInvalid(): boolean {
    return (
      this.budgetForm.controls.tripName.invalid ||
      this.budgetForm.controls.nights.invalid ||
      !this.selectedTravelStyleTitle() ||
      this.recommendedBudget() <= 0
    );
  }

  manualFlowInvalid(): boolean {
    return (
      this.budgetForm.controls.tripName.invalid ||
      this.budgetForm.controls.totalBudget.invalid ||
      this.budgetForm.controls.nights.invalid ||
      !this.selectedTravelStyleTitle()
    );
  }

  stepRoute(step: TripStep): string | null {
    return step.route && this.routeExists(step.route) ? step.route : null;
  }

  stepQueryParams(): { tripPlanningId: number } | undefined {
    const tripPlanningId = this.savedTripPlanningId();
    return tripPlanningId ? { tripPlanningId } : undefined;
  }

  persistBudgetDraft(budget = this.budgetForm.controls.totalBudget.value): void {
    this.tripTempService.updateTripTemp({
      tripName: this.budgetForm.controls.tripName.value.trim(),
      budget,
      currency: this.budgetForm.controls.currency.value,
      durationNights: this.budgetForm.controls.nights.value,
      travelStyle: this.selectedTravelStyleTitle(),
    });
  }

  continueWithRecommendedBudget(): void {
    if (this.recommendedFlowInvalid() || this.isSaving()) {
      this.budgetForm.controls.tripName.markAsTouched();
      this.budgetForm.controls.nights.markAsTouched();
      return;
    }

    // Recommended flow ignores manual budget validation.
    this.saveBudgetStep(this.recommendedBudget(), 'EUR');
  }

  continueWithManualBudget(): void {
    if (this.manualFlowInvalid() || this.isSaving()) {
      this.budgetForm.controls.tripName.markAsTouched();
      this.budgetForm.controls.totalBudget.markAsTouched();
      this.budgetForm.controls.nights.markAsTouched();
      return;
    }

    // Manual flow uses the user-entered budget value.
    this.saveBudgetStep(
      this.budgetForm.controls.totalBudget.value,
      this.budgetForm.controls.currency.value,
    );
  }

  private saveBudgetStep(budget: number, currency: string): void {
    const request: CreateTripBudgetRequest = {
      tripName: this.budgetForm.controls.tripName.value.trim(),
      budget,
      currency,
      duration: this.budgetForm.controls.nights.value,
      travelStyle: this.selectedTravelStyleTitle(),
    };

    this.isSaving.set(true);
    this.saveError.set('');
    this.persistBudgetDraft(budget);

    // Both flows save through the same backend endpoint.
    this.tripPlanningService.saveBudgetStep(request).subscribe({
      next: (response) => {
        this.savedTripPlanningId.set(response.id);
        this.tripTempService.updateTripTemp({ tripPlanningId: response.id });
        this.isSaving.set(false);
        this.navigateAfterBudgetSave(response.id);

      },
      error: () => {
        this.saveError.set('Could not save your budget. Please try again.');
        this.isSaving.set(false);
      },
    });
  }

  private navigateAfterBudgetSave(tripPlanningId: number): void {
    const destinationRoute = '/trips/create/destination';

    if (this.routeExists(destinationRoute)) {
      void this.router.navigate([destinationRoute], { queryParams: { tripPlanningId } });
      return;
    }

    // Flights step is skipped until it is implemented.
    if (this.routeExists('/trips/create/hotels')) {
      void this.router.navigate(['/trips/create/hotels'], { queryParams: { tripPlanningId } });
    }
  }

  private restoreBudgetDraft(): void {
    const tripTemp = this.tripTempService.getTripTemp();
    const restoredStyle = this.travelStyles.find(
      (style) => style.title === tripTemp.travelStyle || style.id === tripTemp.travelStyle,
    );

    this.budgetForm.patchValue({
      tripName: tripTemp.tripName,
      totalBudget: tripTemp.budget ?? 0,
      currency: tripTemp.currency,
      nights: tripTemp.durationNights,
    });

    this.selectedTravelStyle.set(restoredStyle?.id ?? 'mid-range');
    this.savedTripPlanningId.set(tripTemp.tripPlanningId ?? null);
    this.applyRecommendedBudget();
  }

  private routeExists(route: string): boolean {
    const normalizedRoute = route.replace(/^\//, '');
    return this.router.config.some((routeConfig) => routeConfig.path === normalizedRoute);
  }
}
