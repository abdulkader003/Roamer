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

interface CalendarDay {
  day: number;
  type: 'prev' | 'curr' | 'today';
}

interface WorldWeatherItem {
  city: string;
  icon: string;
  temperature: string;
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
  private readonly today = new Date();

  readonly currentMonthLabel = this.today.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

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

  worldWeather = signal<WorldWeatherItem[]>([
    { city: 'Paris', icon: '☀️', temperature: '24°C' },
    { city: 'Dubai', icon: '🌤️', temperature: '38°C' },
    { city: 'London', icon: '🌧️', temperature: '17°C' },
    { city: 'Tokyo', icon: '☁️', temperature: '22°C' },
    { city: 'New York', icon: '🌦️', temperature: '19°C' },
  ]);

  calDays = signal<CalendarDay[]>(this.buildCurrentMonthCalendarDays(this.today));

  budgetItems = signal<BudgetItem[]>([
    { label: 'Flights',       amount: '€850', color: '#1A56DB', dashArray: '117.5 209', dashOffset: '0' },
    { label: 'Accommodation', amount: '€900', color: '#0EA5E9', dashArray: '124.4 202', dashOffset: '-117.5' },
    { label: 'Activities',    amount: '€300', color: '#7C3AED', dashArray: '41.5 285',  dashOffset: '-241.9' },
    { label: 'Events',        amount: '€200', color: '#F59E0B', dashArray: '27.7 299',  dashOffset: '-283.4' },
    { label: 'Attractions',   amount: '€200', color: '#0F9D58', dashArray: '27.7 299',  dashOffset: '-311.1' },
    { label: 'Beaches',       amount: '€150', color: '#10B981', dashArray: '20.7 306',  dashOffset: '-338.8' },
    { label: 'Parties',       amount: '€100', color: '#EC4899', dashArray: '13.8 313',  dashOffset: '-359.5' },
  ]);

  private buildCurrentMonthCalendarDays(date: Date): CalendarDay[] {
    const year = date.getFullYear();
    const month = date.getMonth();
    const currentDay = date.getDate();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPreviousMonth = new Date(year, month, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const leadingDays = (firstDay + 6) % 7;
    const days: CalendarDay[] = [];

    for (let index = leadingDays - 1; index >= 0; index--) {
      days.push({ day: daysInPreviousMonth - index, type: 'prev' });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      days.push({ day, type: day === currentDay ? 'today' : 'curr' });
    }

    return days;
  }
}
