import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ACTIVITIES, Activity, ActivityCategory } from '../../services/activities';

@Component({
  selector: 'app-activities-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './activities-list.html',
  styleUrls: ['./activities-list.css'],
})
export class ActivitiesListComponent {
  searchTerm = '';
  selectedCity = 'All Cities';
  selectedCategory = 'All Categories';
  selectedPriceLevel = 'All Prices';
  selectedTimeOfDay = 'Any Time';
  selectedSort = 'recommended';

  readonly cities: string[] = [
    'London',
    'Berlin',
    'Barcelona',
    'Madrid',
    'Madera',
    'Paris',
    'Rome',
    'Mailand',
    'Wien',
    'Budapest',
  ];

  readonly categories: ActivityCategory[] = [
    'Sightseeing',
    'Adventure',
    'Nightlife',
    'Food & Drink',
    'Relax',
    'Culture',
  ];

  readonly activities: Activity[] = ACTIVITIES;

  get filteredActivities(): Activity[] {
    let filtered = this.activities.filter((activity) => {
      const search = this.searchTerm.trim().toLowerCase();

      const matchesSearch =
        !search ||
        activity.title.toLowerCase().includes(search) ||
        activity.city.toLowerCase().includes(search) ||
        activity.category.toLowerCase().includes(search) ||
        activity.venue.toLowerCase().includes(search) ||
        activity.description.toLowerCase().includes(search);

      const matchesCity = this.selectedCity === 'All Cities' || activity.city === this.selectedCity;

      const matchesCategory =
        this.selectedCategory === 'All Categories' || activity.category === this.selectedCategory;

      const matchesPrice =
        this.selectedPriceLevel === 'All Prices' || activity.priceLevel === this.selectedPriceLevel;

      const matchesTime =
        this.selectedTimeOfDay === 'Any Time' || activity.timeOfDay === this.selectedTimeOfDay;

      return matchesSearch && matchesCity && matchesCategory && matchesPrice && matchesTime;
    });

    switch (this.selectedSort) {
      case 'price-low':
        filtered = [...filtered].sort((a, b) => a.price - b.price);
        break;
      case 'price-high':
        filtered = [...filtered].sort((a, b) => b.price - a.price);
        break;
      case 'rating':
        filtered = [...filtered].sort((a, b) => b.rating - a.rating);
        break;
      case 'city':
        filtered = [...filtered].sort((a, b) => a.city.localeCompare(b.city));
        break;
      case 'title':
        filtered = [...filtered].sort((a, b) => a.title.localeCompare(b.title));
        break;
      default:
        filtered = [...filtered].sort((a, b) => {
          if ((b.featured ? 1 : 0) !== (a.featured ? 1 : 0)) {
            return (b.featured ? 1 : 0) - (a.featured ? 1 : 0);
          }
          return b.rating - a.rating;
        });
    }

    return filtered;
  }

  get totalActivities(): number {
    return this.activities.length;
  }

  get filteredCount(): number {
    return this.filteredActivities.length;
  }

  get featuredCount(): number {
    return this.activities.filter((activity) => activity.featured).length;
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.selectedCity = 'All Cities';
    this.selectedCategory = 'All Categories';
    this.selectedPriceLevel = 'All Prices';
    this.selectedTimeOfDay = 'Any Time';
    this.selectedSort = 'recommended';
  }

  getCategoryClass(category: string): string {
    return category.toLowerCase().replace(/\s+/g, '-').replace(/&/g, '');
  }

  trackByActivityId(index: number, activity: Activity): number {
    return activity.id;
  }
}
