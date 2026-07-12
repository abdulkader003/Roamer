import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, EventEmitter, Input, NgZone, OnDestroy, OnInit, Output, inject } from '@angular/core';

import {
  CountryMapShape,
  WORLD_COUNTRIES,
  resolveCountryName
} from './travel-country-data';

type CountryMapState = 'neutral' | 'visited' | 'upcoming' | 'both';

@Component({
  selector: 'app-world-travel-map',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './world-travel-map.component.html',
  styleUrl: './world-travel-map.component.scss'
})
export class WorldTravelMapComponent implements OnInit, OnDestroy {
  private readonly zone = inject(NgZone);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input() visitedCountries: readonly string[] = [];
  @Input() upcomingCountries: readonly string[] = [];
  @Input() isLoadingUpcomingCountries = false;
  @Input() upcomingCountriesError = '';
  @Input() upcomingTripCount = 0;

  @Output() visitedCountryAdded = new EventEmitter<string>();
  @Output() visitedCountryRemoved = new EventEmitter<string>();

  readonly countryOptions = WORLD_COUNTRIES;
  readonly graticuleVerticalLines = [-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150];
  readonly graticuleHorizontalLines = [-60, -30, 0, 30, 60];

  countryShapes: readonly CountryMapShape[] = [];
  selectedCountry = '';
  isMapExpanded = false;
  hoveredCountry = '';
  isLoadingMap = true;
  mapLoadError = '';

  ngOnInit(): void {
    void import('./travel-map-shapes')
      .then(({ COUNTRY_MAP_SHAPES }) => this.zone.run(() => {
        this.countryShapes = COUNTRY_MAP_SHAPES;
        this.isLoadingMap = false;
        this.cdr.detectChanges();
      }))
      .catch(() => this.zone.run(() => {
        this.mapLoadError = 'Could not load the world map.';
        this.isLoadingMap = false;
        this.cdr.detectChanges();
      }));
  }

  ngOnDestroy(): void {
    this.setExpandedBodyState(false);
  }

  get visitedCountrySet(): Set<string> {
    return new Set(this.visitedCountries);
  }

  get upcomingCountrySet(): Set<string> {
    return new Set(this.upcomingCountries);
  }

  get availableCountries(): readonly string[] {
    const visited = this.visitedCountrySet;
    return this.countryOptions.filter((country) => !visited.has(country));
  }

  get visitedPercentage(): number {
    return Math.round((this.visitedCountries.length / this.countryOptions.length) * 100);
  }

  get visitedProgress(): number {
    return Math.max(1, Math.min(100, this.visitedPercentage));
  }

  get upcomingOnlyCountries(): string[] {
    const visited = this.visitedCountrySet;
    return this.upcomingCountries.filter((country) => !visited.has(country));
  }

  get countriesWithMapShape(): number {
    const visibleCountries = new Set(this.countryShapes.map((shape) => shape.name));
    return [...this.visitedCountries, ...this.upcomingCountries]
      .filter((country, index, countries) => countries.indexOf(country) === index)
      .filter((country) => visibleCountries.has(country))
      .length;
  }

  get selectedCountryCanBeAdded(): boolean {
    return this.resolveSelectedCountry() !== null;
  }

  setHoveredCountry(country: string): void {
    this.hoveredCountry = country;
  }

  clearHoveredCountry(): void {
    this.hoveredCountry = '';
  }

  countryState(shape: CountryMapShape): CountryMapState {
    const visited = this.visitedCountrySet.has(shape.name);
    const upcoming = this.upcomingCountrySet.has(shape.name);

    if (visited && upcoming) {
      return 'both';
    }

    if (visited) {
      return 'visited';
    }

    if (upcoming) {
      return 'upcoming';
    }

    return 'neutral';
  }

  countryClass(shape: CountryMapShape): string {
    const state = this.countryState(shape);
    const isHovered = this.hoveredCountry === shape.name ? ' country-shape--hovered' : '';
    return `country-shape country-shape--${state}${isHovered}`;
  }

  longitudeX(longitude: number): number {
    return (longitude + 180) * 1000 / 360;
  }

  latitudeY(latitude: number): number {
    return (90 - latitude) * 520 / 180;
  }

  shapeTitle(shape: CountryMapShape): string {
    const state = this.countryState(shape);

    if (state === 'both') {
      return `${shape.name}: visited and upcoming`;
    }

    if (state === 'visited') {
      return `${shape.name}: visited`;
    }

    if (state === 'upcoming') {
      return `${shape.name}: upcoming trip`;
    }

    return `${shape.name}: not marked`;
  }

  onCountryInput(event: Event): void {
    this.selectedCountry = (event.target as HTMLInputElement).value;
  }

  addSelectedCountry(): void {
    const country = this.resolveSelectedCountry();

    if (!country) {
      return;
    }

    this.visitedCountryAdded.emit(country);
    this.selectedCountry = '';
  }

  toggleVisitedCountry(country: string): void {
    if (this.visitedCountrySet.has(country)) {
      this.visitedCountryRemoved.emit(country);
      return;
    }

    this.visitedCountryAdded.emit(country);
  }

  removeVisitedCountry(country: string): void {
    this.visitedCountryRemoved.emit(country);
  }

  openExpandedMap(): void {
    this.isMapExpanded = true;
    this.setExpandedBodyState(true);
  }

  closeExpandedMap(): void {
    this.isMapExpanded = false;
    this.setExpandedBodyState(false);
  }

  private resolveSelectedCountry(): string | null {
    return resolveCountryName(this.selectedCountry, this.visitedCountries);
  }

  private setExpandedBodyState(isExpanded: boolean): void {
    if (typeof document === 'undefined') {
      return;
    }

    document.body.classList.toggle('profile-map-expanded', isExpanded);
  }
}
