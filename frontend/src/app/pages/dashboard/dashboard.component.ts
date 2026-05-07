import { ChangeDetectionStrategy, Component, signal, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ThemeService } from '../../services/theme.service';

interface Trip {
  name: string;
  dates: string;
  budget: string;
  status: 'confirmed' | 'pending';
  image: string;
}

interface Experience {
  name: string;
  location: string;
  price: string;
  image: string;
}

interface BudgetItem {
  label: string;
  amount: string;
  color: string;
  dashArray: string;
  dashOffset: string;
}

interface ExploreItem {
  label: string;
  bgColor: string;
  strokeColor: string;
  icon: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent {
  // ThemeService is injected so the effect() in the service runs and sets data-theme on <html>
  private themeService = inject(ThemeService);

  trips = signal<Trip[]>([
    {
      name: 'Paris, France',
      dates: '15 Jun – 22 Jun, 2024',
      budget: '€1,200',
      status: 'confirmed',
      image: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=200&q=80',
    },
    {
      name: 'Zermatt, Switzerland',
      dates: '08 Jul – 14 Jul, 2024',
      budget: '€1,800',
      status: 'pending',
      image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=200&q=80',
    },
  ]);

  experiences = signal<Experience[]>([
    { name: 'Sunset Yacht Party', location: 'Dubai, UAE', price: '€120.00', image: 'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=400&q=80' },
    { name: 'Summer Music Festival', location: 'Barcelona, Spain', price: '€89.00', image: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=400&q=80' },
    { name: 'Bali Surf Experience', location: 'Bali, Indonesia', price: '€75.00', image: 'https://images.unsplash.com/photo-1506953823976-52e1fdc0149a?w=400&q=80' },
    { name: 'Mixology Masterclass', location: 'London, UK', price: '€45.00', image: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=400&q=80' },
  ]);

  exploreItems = signal<ExploreItem[]>([
    { label: 'Flights', bgColor: 'var(--explore-flights-bg)', strokeColor: 'var(--explore-flights-stroke)', icon: `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" width="22" height="22"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>` },
    { label: 'Events', bgColor: 'var(--explore-events-bg)', strokeColor: 'var(--explore-events-stroke)', icon: `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" width="22" height="22"><path d="M20 12V22H4V12"/><path d="M22 7H2v5h20V7z"/><path d="M12 22V7"/></svg>` },
    { label: 'Activities', bgColor: 'var(--explore-activities-bg)', strokeColor: 'var(--explore-activities-stroke)', icon: `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" width="22" height="22"><circle cx="12" cy="12" r="10"/><path d="M8.56 2.75c4.37 6.03 6.02 9.42 8.03 17.72"/></svg>` },
    { label: 'Attractions', bgColor: 'var(--explore-attractions-bg)', strokeColor: 'var(--explore-attractions-stroke)', icon: `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" width="22" height="22"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>` },
    { label: 'Beaches', bgColor: 'var(--explore-beaches-bg)', strokeColor: 'var(--explore-beaches-stroke)', icon: `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" width="22" height="22"><path d="M2 22s4-5 10-5 10 5 10 5"/><path d="M12 17c-2.76 0-5-1.34-5-3 0-2.21 2.24-4 5-4s5 1.79 5 4c0 1.66-2.24 3-5 3z"/></svg>` },
    { label: 'Parties', bgColor: 'var(--explore-parties-bg)', strokeColor: 'var(--explore-parties-stroke)', icon: `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" width="22" height="22"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>` },
  ]);

  calDays = signal<{ day: number; type: 'prev' | 'curr' | 'today' }[]>([
    { day: 27, type: 'prev' }, { day: 28, type: 'prev' }, { day: 29, type: 'prev' }, { day: 30, type: 'prev' },
    { day: 1, type: 'curr' }, { day: 2, type: 'curr' }, { day: 3, type: 'curr' },
    { day: 4, type: 'curr' }, { day: 5, type: 'curr' }, { day: 6, type: 'curr' }, { day: 7, type: 'today' },
    { day: 8, type: 'curr' }, { day: 9, type: 'curr' }, { day: 10, type: 'curr' },
    { day: 11, type: 'curr' }, { day: 12, type: 'curr' }, { day: 13, type: 'curr' }, { day: 14, type: 'curr' },
    { day: 15, type: 'curr' }, { day: 16, type: 'curr' }, { day: 17, type: 'curr' },
    { day: 18, type: 'curr' }, { day: 19, type: 'curr' }, { day: 20, type: 'curr' }, { day: 21, type: 'curr' },
    { day: 22, type: 'curr' }, { day: 23, type: 'curr' }, { day: 24, type: 'curr' },
    { day: 25, type: 'curr' }, { day: 26, type: 'curr' }, { day: 27, type: 'curr' }, { day: 28, type: 'curr' },
    { day: 29, type: 'curr' }, { day: 30, type: 'curr' }, { day: 31, type: 'curr' },
  ]);

  budgetItems = signal<BudgetItem[]>([
    { label: 'Flights',       amount: '€850', color: '#1A56DB', dashArray: '117.5 209', dashOffset: '0' },
    { label: 'Accommodation', amount: '€900', color: '#0EA5E9', dashArray: '124.4 202', dashOffset: '-117.5' },
    { label: 'Activities',    amount: '€300', color: '#7C3AED', dashArray: '41.5 285',  dashOffset: '-241.9' },
    { label: 'Events',        amount: '€200', color: '#F59E0B', dashArray: '27.7 299',  dashOffset: '-283.4' },
    { label: 'Attractions',   amount: '€200', color: '#0F9D58', dashArray: '27.7 299',  dashOffset: '-311.1' },
    { label: 'Beaches',       amount: '€150', color: '#10B981', dashArray: '20.7 306',  dashOffset: '-338.8' },
    { label: 'Parties',       amount: '€100', color: '#EC4899', dashArray: '13.8 313',  dashOffset: '-359.5' },
  ]);
}
