import { Injectable, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

export type WallpaperPage =
  | 'dashboard'
  | 'trips'
  | 'flights'
  | 'hotels'
  | 'activities'
  | 'budget'
  | 'calendar'
  | 'profile'
  | 'settings';

export interface WallpaperImage {
  id: string;
  url: string;
  position?: string;
  desktopPosition?: string;
  tabletPosition?: string;
  mobilePosition?: string;
  backgroundSize?: string;
  desktopBackgroundSize?: string;
  tabletBackgroundSize?: string;
  mobileBackgroundSize?: string;
  scale?: number;
  desktopScale?: number;
  tabletScale?: number;
  mobileScale?: number;
  startScale?: number;
  desktopStartScale?: number;
  tabletStartScale?: number;
  mobileStartScale?: number;
  panX?: string;
  panY?: string;
}

export interface WallpaperLayer {
  id: string;
  url: string;
  position: string;
  desktopPosition?: string;
  tabletPosition?: string;
  mobilePosition?: string;
  backgroundSize: string;
  desktopBackgroundSize?: string;
  tabletBackgroundSize?: string;
  mobileBackgroundSize?: string;
  scale: number;
  desktopScale?: number;
  tabletScale?: number;
  mobileScale?: number;
  startScale: number;
  desktopStartScale?: number;
  tabletStartScale?: number;
  mobileStartScale?: number;
  panX: string;
  panY: string;
  active: boolean;
}

export interface WallpaperHero {
  kicker: string;
  title: string;
  description: string;
}

const ROTATION_INTERVAL_MS = 30000;
const CROSSFADE_MS = 2600;
const PRELOAD_TIMEOUT_MS = 4500;
const WALLPAPER_URL_PARAMS = '?auto=format&fit=crop&w=2880&q=96';

@Injectable({ providedIn: 'root' })
export class WallpaperService {
  private readonly router = inject(Router);
  private readonly activePage = signal<WallpaperPage | null>(null);
  private readonly activeIndex = signal(0);
  private readonly layers = signal<WallpaperLayer[]>([]);
  private rotationId: number | undefined;
  private cleanupId: number | undefined;
  private preloaded = new Set<string>();
  private failed = new Set<string>();
  private rotationRun = 0;

  readonly currentPage = this.activePage.asReadonly();
  readonly visibleLayers = this.layers.asReadonly();
  readonly hasWallpaper = computed(() => this.layers().length > 0);
  readonly currentHero = computed<WallpaperHero | null>(() => {
    const page = this.activePage();
    if (!page || page === 'dashboard') {
      return null;
    }

    return this.heroes[page];
  });

  readonly heroes: Record<WallpaperPage, WallpaperHero> = {
    dashboard: {
      kicker: 'Travel command center',
      title: 'Where to next?',
      description: 'Plan flights, stays, activities, budgets, and shared trips from one calm travel workspace.'
    },
    trips: {
      kicker: 'Journeys',
      title: 'Your trips.',
      description: 'Manage every itinerary, invitation, draft, and upcoming adventure in one place.'
    },
    flights: {
      kicker: 'Flights',
      title: 'Find your flight.',
      description: 'Search and compare fares across airlines, then add the right route to your trip.'
    },
    hotels: {
      kicker: 'Stays',
      title: 'Find your hotel.',
      description: 'Discover premium stays, compare details, and keep your bookings aligned with your plans.'
    },
    activities: {
      kicker: 'Experiences',
      title: 'Find your activity.',
      description: 'Explore memorable tours, landmarks, local favorites, and travel moments worth saving.'
    },
    budget: {
      kicker: 'Budget',
      title: 'Track your spend.',
      description: 'Keep budgets, expenses, and remaining balances clear across every trip.'
    },
    calendar: {
      kicker: 'Schedule',
      title: 'Your travel calendar.',
      description: 'See flights, hotels, activities, and custom plans in a timeline built for travel.'
    },
    profile: {
      kicker: 'Traveler profile',
      title: 'Profile command center.',
      description: 'Manage traveler details, airport preferences, interests, picture, and account settings.'
    },
    settings: {
      kicker: 'Preferences',
      title: 'Settings.',
      description: 'Tune notifications, privacy, display preferences, feedback, and support information.'
    }
  };

  readonly wallpapers: Record<WallpaperPage, WallpaperImage[]> = {
    dashboard: [
      image('dashboard-mountains', 'photo-1501785888041-af3ef285b470', { position: 'center 42%', mobilePosition: 'center 46%', scale: 1.025 }),
      image('dashboard-coast', 'photo-1507525428034-b723cf961d3e', { position: 'center 54%', mobilePosition: 'center 52%' }),
      image('dashboard-road', 'photo-1469854523086-cc02fe5d8800', { position: 'center 54%', mobilePosition: 'center 50%' }),
      image('dashboard-alps', 'photo-1464822759023-fed622ff2c3b', { position: 'center 44%', mobilePosition: 'center 48%' }),
      image('dashboard-lake', 'photo-1470770841072-f978cf4d019e', { position: 'center 48%', mobilePosition: 'center 50%' }),
      image('dashboard-world', 'photo-1500530855697-b586d89ba3ee', { position: 'center 52%', mobilePosition: 'center 50%' })
    ],
    trips: [
      image('trips-santorini', 'photo-1570077188670-e3a8d69ac5ff', { position: 'center 48%', mobilePosition: 'center 52%', scale: 1.02 }),
      image('trips-italy', 'photo-1523906834658-6e24ef2386f9', { position: 'center 44%', mobilePosition: 'center 48%', scale: 1.018 }),
      image('trips-dubai', 'photo-1512453979798-5ea266f8880c', { position: 'center 46%', mobilePosition: 'center 48%' }),
      image('trips-maldives', 'photo-1514282401047-d79a71a590e8', { position: 'center 54%', mobilePosition: 'center 52%' }),
      image('trips-paris', 'photo-1502602898657-3e91760cbb34', { position: 'center 42%', tabletPosition: 'center 44%', mobilePosition: 'center 46%', scale: 1.008, startScale: 1, panX: '0%', panY: '0%' }),
      image('trips-japan', 'photo-1493976040374-85c8e12f0c0e', { position: 'center 44%', mobilePosition: 'center 48%', scale: 1.012, startScale: 1 })
    ],
    flights: [
      image('flights-window', 'photo-1436491865332-7a61a109cc05', { position: 'center 44%', mobilePosition: 'center 48%' }),
      image('flights-wing', 'photo-1521727857535-28d2047314ac', { position: 'center 50%', mobilePosition: 'center 52%' }),
      image('flights-airport', 'photo-1530521954074-e64f6810b32d', { position: 'center 54%', mobilePosition: 'center 50%' }),
      image('flights-clouds', 'photo-1464037866556-6812c9d1c72e', { position: 'center 48%', mobilePosition: 'center 50%' }),
      image('flights-runway', 'photo-1517479149777-5f3b1511d5ad', { position: 'center 52%', mobilePosition: 'center 54%' }),
      image('flights-plane', 'photo-1556388158-158ea5ccacbd', { position: 'center 50%', mobilePosition: 'center 52%' })
    ],
    hotels: [
      image('hotels-lobby', 'photo-1542314831-068cd1dbfeeb', { position: 'center 50%', mobilePosition: 'center 52%' }),
      image('hotels-resort', 'photo-1566073771259-6a8506099945', { position: 'center 54%', mobilePosition: 'center 54%' }),
      image('hotels-room', 'photo-1611892440504-42a792e24d32', { position: 'center 50%', mobilePosition: 'center 50%' }),
      image('hotels-pool', 'photo-1571896349842-33c89424de2d', { position: 'center 56%', mobilePosition: 'center 56%' }),
      image('hotels-villa', 'photo-1582719508461-905c673771fd', { position: 'center 54%', mobilePosition: 'center 54%' }),
      image('hotels-suite', 'photo-1590490360182-c33d57733427', { position: 'center 50%', mobilePosition: 'center 52%' })
    ],
    activities: [
      image('activities-taj', 'photo-1524492412937-b28074a5d7da', { position: 'center 44%', mobilePosition: 'center 48%', scale: 1.01, startScale: 1, panX: '0%', panY: '0%' }),
      image('activities-city', 'photo-1519501025264-65ba15a82390', { position: 'center 48%', mobilePosition: 'center 50%' }),
      image('activities-market', 'photo-1533105079780-92b9be482077', { position: 'center 52%', mobilePosition: 'center 54%' }),
      image('activities-hike', 'photo-1551632811-561732d1e306', { position: 'center 44%', mobilePosition: 'center 48%' }),
      image('activities-canyon', 'photo-1500534314209-a25ddb2bd429', { position: 'center 48%', mobilePosition: 'center 50%' })
    ],
    budget: [
      image('budget-map', 'photo-1488646953014-85cb44e25828', { position: 'center 52%', mobilePosition: 'center 52%' }),
      image('budget-calculator', 'photo-1554224155-6726b3ff858f', { position: 'center 52%', mobilePosition: 'center 54%' }),
      image('budget-ledger', 'photo-1554224154-26032fced8bd', { position: 'center 50%', mobilePosition: 'center 52%' }),
      image('budget-currency', 'photo-1526304640581-d334cdbbf45e', { position: 'center 52%', mobilePosition: 'center 52%' }),
      image('budget-workspace', 'photo-1501339847302-ac426a4a7cbb', { position: 'center 54%', mobilePosition: 'center 54%' })
    ],
    calendar: [
      image('calendar-planner', 'photo-1506784983877-45594efa4cbe', { position: 'center 52%', mobilePosition: 'center 52%' }),
      image('calendar-journal', 'photo-1517842645767-c639042777db', { position: 'center 52%', mobilePosition: 'center 52%' }),
      image('calendar-desk-plan', 'photo-1484480974693-6ca0a78fb36b', { position: 'center 50%', mobilePosition: 'center 52%' }),
      image('calendar-notebook', 'photo-1499750310107-5fef28a66643', { position: 'center 52%', mobilePosition: 'center 54%' }),
      image('calendar-workspace', 'photo-1516321318423-f06f85e504b3', { position: 'center 50%', mobilePosition: 'center 52%' })
    ],
    profile: [
      image('profile-passport', 'photo-1489345745023-ab5086c7c591', { position: 'center 52%', mobilePosition: 'center 52%' }),
      image('profile-map', 'photo-1452421822248-d4c2b47f0c81', { position: 'center 50%', mobilePosition: 'center 52%' }),
      image('profile-essentials', 'photo-1528127269322-539801943592', { position: 'center 52%', mobilePosition: 'center 52%' }),
      image('profile-luggage', 'photo-1500835556837-99ac94a94552', { position: 'center 52%', mobilePosition: 'center 54%' }),
      image('profile-memories', 'photo-1526772662000-3f88f10405ff', { position: 'center 48%', mobilePosition: 'center 50%' })
    ],
    settings: [
      image('settings-workspace', 'photo-1497366754035-f200968a6e72', { position: 'center 50%', mobilePosition: 'center 52%' }),
      image('settings-desk', 'photo-1497032628192-86f99bcd76bc', { position: 'center 52%', mobilePosition: 'center 54%' }),
      image('settings-organized', 'photo-1497215728101-856f4ea42174', { position: 'center 50%', mobilePosition: 'center 52%' }),
      image('settings-studio', 'photo-1524758631624-e2822e304c36', { position: 'center 50%', mobilePosition: 'center 52%' }),
      image('settings-devices', 'photo-1519389950473-47ba0277781c', { position: 'center 50%', mobilePosition: 'center 52%' })
    ]
  };

  constructor() {
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => this.setPageFromUrl(event.urlAfterRedirects));

    this.setPageFromUrl(this.router.url);
  }

  private setPageFromUrl(url: string): void {
    const page = this.resolvePage(url);
    if (page === this.activePage()) return;

    const run = ++this.rotationRun;
    this.activePage.set(page);
    this.stopRotation();

    if (!page) {
      this.activeIndex.set(0);
      this.layers.set([]);
      return;
    }

    const pageWallpapers = this.wallpapers[page];
    const startIndex = Math.floor(Math.random() * pageWallpapers.length);

    this.activeIndex.set(startIndex);
    const first = pageWallpapers[startIndex];
    this.showWallpaper(first, true);
    void this.ensureInitialWallpaperLoaded(page, startIndex, run);
    this.preloadNext(page, startIndex);
    this.startRotation(run);
  }

  private startRotation(run: number): void {
    window.clearInterval(this.rotationId);
    this.rotationId = window.setInterval(() => {
      void this.rotate(run);
    }, ROTATION_INTERVAL_MS);
  }

  private async rotate(run: number): Promise<void> {
    if (run !== this.rotationRun) return;

    const page = this.activePage();
    if (!page) return;

    const pageWallpapers = this.wallpapers[page];
    const currentIndex = this.activeIndex();
    const nextMatch = await this.findNextLoadableWallpaper(page, currentIndex, run);

    if (!nextMatch || run !== this.rotationRun || this.activePage() !== page) return;

    this.activeIndex.set(nextMatch.index);
    this.showWallpaper(nextMatch.wallpaper, false);
    this.preloadNext(page, nextMatch.index);
  }

  private async ensureInitialWallpaperLoaded(page: WallpaperPage, index: number, run: number): Promise<void> {
    const wallpaper = this.wallpapers[page][index];
    const loaded = await this.preload(wallpaper.url);

    if (loaded || run !== this.rotationRun || this.activePage() !== page || this.activeIndex() !== index) {
      return;
    }

    void this.rotate(run);
  }

  private showWallpaper(wallpaper: WallpaperImage, replace: boolean): void {
    const nextLayer: WallpaperLayer = {
      id: `${wallpaper.id}-${Date.now()}`,
      url: wallpaper.url,
      position: wallpaper.position ?? 'center',
      desktopPosition: wallpaper.desktopPosition,
      tabletPosition: wallpaper.tabletPosition,
      mobilePosition: wallpaper.mobilePosition,
      backgroundSize: wallpaper.backgroundSize ?? 'cover',
      desktopBackgroundSize: wallpaper.desktopBackgroundSize,
      tabletBackgroundSize: wallpaper.tabletBackgroundSize,
      mobileBackgroundSize: wallpaper.mobileBackgroundSize,
      scale: wallpaper.scale ?? 1.035,
      desktopScale: wallpaper.desktopScale,
      tabletScale: wallpaper.tabletScale,
      mobileScale: wallpaper.mobileScale,
      startScale: wallpaper.startScale ?? 1.005,
      desktopStartScale: wallpaper.desktopStartScale,
      tabletStartScale: wallpaper.tabletStartScale,
      mobileStartScale: wallpaper.mobileStartScale,
      panX: wallpaper.panX ?? '-0.55%',
      panY: wallpaper.panY ?? '-0.35%',
      active: true
    };

    if (replace) {
      this.layers.set([nextLayer]);
      return;
    }

    this.layers.update((layers) => [
      ...layers.map((layer) => ({ ...layer, active: false })),
      nextLayer
    ]);

    window.clearTimeout(this.cleanupId);
    this.cleanupId = window.setTimeout(() => {
      this.layers.update((layers) => layers.filter((layer) => layer.active));
    }, CROSSFADE_MS + 250);
  }

  private preloadNext(page: WallpaperPage, index: number): void {
    const next = this.wallpapers[page][(index + 1) % this.wallpapers[page].length];
    void this.preload(next.url);
  }

  private async findNextLoadableWallpaper(
    page: WallpaperPage,
    currentIndex: number,
    run: number
  ): Promise<{ index: number; wallpaper: WallpaperImage } | null> {
    const pageWallpapers = this.wallpapers[page];

    for (let offset = 1; offset <= pageWallpapers.length; offset++) {
      if (run !== this.rotationRun || this.activePage() !== page) return null;

      const index = (currentIndex + offset) % pageWallpapers.length;
      const wallpaper = pageWallpapers[index];
      if (this.failed.has(wallpaper.url)) continue;

      const isReady = await this.preload(wallpaper.url);
      if (isReady) return { index, wallpaper };
    }

    this.failed.clear();
    return null;
  }

  private preload(url: string): Promise<boolean> {
    if (this.preloaded.has(url)) return Promise.resolve(true);
    if (this.failed.has(url)) return Promise.resolve(false);

    return new Promise((resolve) => {
      const img = new Image();
      let settled = false;
      const complete = (loaded: boolean): void => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeoutId);

        if (loaded) {
          this.preloaded.add(url);
          this.failed.delete(url);
        } else {
          this.failed.add(url);
        }

        resolve(loaded);
      };
      const timeoutId = window.setTimeout(() => complete(false), PRELOAD_TIMEOUT_MS);

      img.decoding = 'async';
      img.onload = () => complete(true);
      img.onerror = () => complete(false);
      img.src = url;
    });
  }

  private stopRotation(): void {
    window.clearInterval(this.rotationId);
    window.clearTimeout(this.cleanupId);
    this.rotationId = undefined;
    this.cleanupId = undefined;
  }

  private resolvePage(url: string): WallpaperPage | null {
    const path = url.split('?')[0].split('#')[0];

    if (path.startsWith('/dashboard')) return 'dashboard';
    if (path.startsWith('/trips/create/flights') || path.startsWith('/flights')) return 'flights';
    if (path.startsWith('/trips/create/hotels') || path.startsWith('/hotels')) return 'hotels';
    if (path.startsWith('/trips/create/activities') || path.startsWith('/activities')) return 'activities';
    if (path.startsWith('/trips/create/budget') || path.startsWith('/budget-tracker')) return 'budget';
    if (path.startsWith('/trips')) return 'trips';
    if (path.startsWith('/profile')) return 'profile';
    if (path.startsWith('/settings')) return null;

    return null;
  }
}

function image(
  id: string,
  photoId: string,
  options: string | Omit<WallpaperImage, 'id' | 'url'> = {}
): WallpaperImage {
  const config = typeof options === 'string' ? { position: options } : options;

  return {
    id,
    url: `https://images.unsplash.com/${photoId}${WALLPAPER_URL_PARAMS}`,
    ...config
  };
}
