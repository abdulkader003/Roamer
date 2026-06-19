import { CommonModule, Location } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { ActivitiesService, Activity, ActivityAttraction, ActivityImage, ActivityPresale } from '../../services/activities';
import { StatusToastComponent, StatusToastType } from '../../shared/status-toast/status-toast.component';

@Component({
  selector: 'app-activity-details',
  standalone: true,
  imports: [CommonModule, StatusToastComponent],
  templateUrl: './activity-details.html',
  styleUrls: ['./activity-details.css'],
})
export class ActivityDetailsComponent implements OnInit, OnDestroy {
  activity: Activity | null = null;
  loading = true;
  errorMessage = '';
  toastMessage = '';
  toastType: StatusToastType = 'info';
  selectedImageUrl = '';
  private toastTimeoutId: ReturnType<typeof setTimeout> | null = null;

  private readonly fallbackImage = `data:image/svg+xml;utf8,
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675">
      <rect width="1200" height="675" fill="%23111111"/>
      <rect x="30" y="30" width="1140" height="615" rx="28" fill="%23191919" stroke="%23d4a017" stroke-width="2"/>
      <text x="50%" y="48%" dominant-baseline="middle" text-anchor="middle"
            font-family="Arial, sans-serif" font-size="42" fill="%23d4a017">No image available</text>
      <text x="50%" y="57%" dominant-baseline="middle" text-anchor="middle"
            font-family="Arial, sans-serif" font-size="24" fill="%23dddddd">R🌐amer Activities</text>
    </svg>`;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly location: Location,
    private readonly activitiesService: ActivitiesService
  ) {}

  ngOnDestroy(): void {
    if (this.toastTimeoutId) {
      clearTimeout(this.toastTimeoutId);
    }
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');

    if (!id) {
      this.loading = false;
      this.errorMessage = 'No activity id was provided.';
      this.showToast(this.errorMessage, 'error');
      return;
    }

    const cached = this.activitiesService.getCachedActivityById(id);
    if (cached) {
      this.applyActivity(cached);
      this.loading = false;
    }

    this.activitiesService
      .getActivityById(id)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (activity) => {
          this.applyActivity(activity);
        },
        error: (error) => {
          console.error('Failed to load activity details:', error);

          if (!this.activity) {
            this.errorMessage = 'Could not load activity details right now.';
            this.showToast(this.errorMessage, 'error');
          }
        },
      });
  }

  getImageUrl(image?: string): string {
    if (!image || !image.trim()) {
      return this.fallbackImage;
    }

    return image;
  }

  getHeroImageUrl(): string {
    return this.getImageUrl(this.selectedImageUrl || this.activity?.image || '');
  }

  getGalleryImages(activity: Activity): ActivityImage[] {
    const providerImages = Array.isArray(activity.images) ? activity.images.filter((image) => image?.url) : [];

    if (providerImages.length > 0) {
      return providerImages;
    }

    if (activity.image) {
      return [{ url: activity.image, ratio: '16_9' }];
    }

    return [];
  }

  selectImage(image: ActivityImage): void {
    this.selectedImageUrl = image.url || '';
  }

  getDisplayDescription(activity: Activity): string {
    const raw = (activity.description || activity.info || '').trim();

    if (!raw || raw === 'Live event details are loading.') {
      return 'Detailed description is currently limited for this event. Please use the venue, sales, and attraction information as the main reference.';
    }

    return raw;
  }

  getDisplayDuration(activity: Activity): string {
    const raw = (activity.duration || '').trim();

    if (!raw || raw === '2h') {
      return 'See event time';
    }

    return raw;
  }

  getDisplayPrice(activity: Activity): string {
    if (this.hasExplicitFreePrice(activity)) {
      return 'Free';
    }

    const currency = activity.priceCurrency || 'EUR';
    const minPrice = this.resolveMinPrice(activity);
    const maxPrice = this.resolveMaxPrice(activity);

    if (minPrice > 0) {
      const maxPriceLabel = maxPrice > minPrice ? ` - ${currency} ${maxPrice}` : '';
      return `${currency} ${minPrice}${maxPriceLabel}`;
    }

    return `${currency} ${this.generateFallbackPrice(activity)}`;
  }

  getDisplayPriceLevel(activity: Activity): string {
    if (this.hasExplicitFreePrice(activity)) {
      return 'Free';
    }

    if (this.resolveBasePrice(activity) > 0) {
      if (activity.priceLevel && activity.priceLevel !== 'Unknown') {
        return activity.priceLevel;
      }

      return this.resolvePriceLevelFromValue(this.resolveBasePrice(activity));
    }

    if (activity.priceLevel && activity.priceLevel !== 'Free') {
      return activity.priceLevel;
    }

    return 'Unknown';
  }

  getDisplayStartDate(activity: Activity): string {
    const parsed = this.parseDate(activity.startDate);

    if (!parsed) {
      return 'Date pending';
    }

    return parsed.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  getDisplayStartTime(activity: Activity): string {
    const parsed = this.parseDate(activity.startDate);

    if (!parsed) {
      return activity.timeOfDay || 'Time pending';
    }

    return parsed.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  getDisplayEndDate(activity: Activity): string {
    const parsed = this.parseDate(activity.endDate);

    if (!parsed) {
      return 'Not provided';
    }

    return parsed.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  getStatusLabel(activity: Activity): string {
    const status = (activity.status || '').trim().toLowerCase();

    if (!status) {
      return 'On sale';
    }

    return status
      .split(/[-_]/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  getEventType(activity: Activity): string {
    return activity.genre || activity.subGenre || activity.segment || activity.category;
  }

  getVenueAddress(activity: Activity): string {
    const venue = activity.venueDetails;
    const lines = [
      venue?.address?.line1,
      venue?.address?.line2,
      venue?.address?.line3,
      venue?.city?.name,
      venue?.state?.name || venue?.state?.stateCode,
      venue?.postalCode,
      venue?.country?.name,
    ].filter(Boolean);

    if (lines.length > 0) {
      return lines.join(', ');
    }

    return activity.venueAddress || 'Address not available';
  }

  getVenueLocation(activity: Activity): string {
    const details = activity.venueDetails;
    return [
      details?.city?.name || activity.city,
      details?.country?.name || activity.country,
    ].filter(Boolean).join(', ');
  }

  getSalesWindow(activity: Activity): string {
    const start = this.parseDate(activity.salesStartDate || activity.sales?.public?.startDateTime || null);
    const end = this.parseDate(activity.salesEndDate || activity.sales?.public?.endDateTime || null);

    if (!start && !end) {
      return 'Sales window not provided';
    }

    const formattedStart = start ? start.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }) : 'Start pending';

    const formattedEnd = end ? end.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }) : 'End pending';

    return `${formattedStart} → ${formattedEnd}`;
  }

  getPresales(activity: Activity): ActivityPresale[] {
    return Array.isArray(activity.sales?.presales) ? activity.sales!.presales! : [];
  }

  getAttractions(activity: Activity): ActivityAttraction[] {
    return Array.isArray(activity.attractions) ? activity.attractions.filter((item) => item?.name) : [];
  }

  getClassificationChips(activity: Activity): string[] {
    if (!Array.isArray(activity.classifications)) {
      return [];
    }

    const chips = activity.classifications.flatMap((classification) => [
      classification.segment?.name,
      classification.genre?.name,
      classification.subGenre?.name,
      classification.type?.name,
      classification.subType?.name,
    ]);

    return Array.from(new Set(chips.filter(Boolean) as string[]));
  }

  hasTicketLink(activity: Activity): boolean {
    return Boolean(activity.url?.trim());
  }

  hasVenueLink(activity: Activity): boolean {
    return Boolean(activity.venueUrl?.trim());
  }

  hasSeatmap(activity: Activity): boolean {
    return Boolean(activity.seatmapUrl?.trim());
  }

  getCategoryClass(category: string): string {
    return category.toLowerCase().replace(/\s+/g, '-').replace(/&/g, '');
  }

  goBackToActivities(): void {
    if (window.history.length > 1) {
      this.location.back();
      return;
    }

    this.router.navigate(['/activities']);
  }

  private applyActivity(activity: Activity): void {
    this.activity = activity;

    if (!this.selectedImageUrl || !this.getGalleryImages(activity).some((image) => image.url === this.selectedImageUrl)) {
      this.selectedImageUrl = this.getGalleryImages(activity)[0]?.url || activity.image || '';
    }
  }

  private parseDate(value?: string | null): Date | null {
    if (!value) {
      return null;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private showToast(message: string, type: StatusToastType = 'info'): void {
    this.toastMessage = message;
    this.toastType = type;

    if (this.toastTimeoutId) {
      clearTimeout(this.toastTimeoutId);
    }

    this.toastTimeoutId = setTimeout(() => {
      this.toastMessage = '';
      this.toastTimeoutId = null;
    }, 2600);
  }

  private hasExplicitFreePrice(activity: Activity): boolean {
    return activity.priceLevel === 'Free';
  }

  private resolveBasePrice(activity: Activity): number {
    return this.resolvePositiveNumber(activity.price) || this.resolveMinPrice(activity) || this.generateFallbackPrice(activity);
  }

  private resolveMinPrice(activity: Activity): number {
    return this.resolvePositiveNumber(activity.minPrice) || this.resolvePositiveNumber(activity.price) || this.generateFallbackPrice(activity);
  }

  private resolveMaxPrice(activity: Activity): number {
    return this.resolvePositiveNumber(activity.maxPrice) || this.resolveMinPrice(activity);
  }

  private resolvePositiveNumber(value: number | null | undefined): number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : 0;
  }

  private generateFallbackPrice(activity: Activity): number {
    const seed = [
      activity.id,
      activity.title,
      activity.venue,
      activity.startDate,
      activity.city,
    ].filter(Boolean).join('|');

    let hash = 0;

    for (let i = 0; i < seed.length; i += 1) {
      hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
    }

    return 15 + (Math.abs(hash) % 106);
  }

  private resolvePriceLevelFromValue(price: number): string {
    if (price <= 25) {
      return 'Budget';
    }

    if (price <= 75) {
      return 'Mid-Range';
    }

    return 'Premium';
  }
}
