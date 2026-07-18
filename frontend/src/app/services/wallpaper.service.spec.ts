import { TestBed, fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';
import { NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { WallpaperService } from './wallpaper.service';

class MockImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  decoding = '';

  set src(value: string) {
    setTimeout(() => {
      if (MockImage.failedUrls.has(value)) {
        this.onerror?.();
        return;
      }

      this.onload?.();
    }, 0);
  }

  static failedUrls = new Set<string>();
}

describe('WallpaperService', () => {
  let events: Subject<NavigationEnd>;
  let router: { url: string; events: Subject<NavigationEnd> };
  let originalImage: typeof Image;
  let randomSpy: jasmine.Spy;

  beforeEach(() => {
    events = new Subject<NavigationEnd>();
    router = {
      url: '/dashboard',
      events
    };
    MockImage.failedUrls.clear();
    originalImage = window.Image;
    (window as unknown as { Image: typeof Image }).Image = MockImage as unknown as typeof Image;
    randomSpy = spyOn(Math, 'random').and.returnValue(0);

    TestBed.configureTestingModule({
      providers: [
        WallpaperService,
        { provide: Router, useValue: router }
      ]
    });
  });

  afterEach(() => {
    const service = TestBed.inject(WallpaperService);
    (service as unknown as { stopRotation: () => void }).stopRotation();
    (window as unknown as { Image: typeof Image }).Image = originalImage;
    events.complete();
    TestBed.resetTestingModule();
  });

  it('initializes the active page, hero, and first wallpaper from the current route', fakeAsync(() => {
    const service = TestBed.inject(WallpaperService);
    tick();

    expect(service.currentPage()).toBe('dashboard');
    expect(service.currentHero()).toBeNull();
    expect(service.hasWallpaper()).toBeTrue();
    expect(service.visibleLayers().length).toBe(1);
    expect(service.visibleLayers()[0]).toEqual(jasmine.objectContaining({
      url: service.wallpapers.dashboard[0].url,
      position: 'center 42%',
      backgroundSize: 'cover',
      scale: 1.025,
      startScale: 1.005,
      panX: '-0.55%',
      panY: '-0.35%',
      active: true
    }));
  }));

  it('switches wallpapers automatically when the route changes', fakeAsync(() => {
    const service = TestBed.inject(WallpaperService);

    router.url = '/profile';
    events.next(new NavigationEnd(1, '/profile', '/profile'));
    tick();

    expect(service.currentPage()).toBe('profile');
    expect(service.currentHero()).toEqual(service.heroes.profile);
    expect(service.visibleLayers().length).toBe(1);
    expect(service.visibleLayers()[0].url).toBe(service.wallpapers.profile[0].url);
    expect(service.visibleLayers()[0].active).toBeTrue();
  }));

  it('rotates to the next loadable wallpaper on the interval', fakeAsync(() => {
    const service = TestBed.inject(WallpaperService);

    tick(30000);
    tick();
    flushMicrotasks();

    const layers = service.visibleLayers();
    expect(layers.length).toBe(2);
    expect(layers[0]).toEqual(jasmine.objectContaining({
      url: service.wallpapers.dashboard[0].url,
      active: false
    }));
    expect(layers[1]).toEqual(jasmine.objectContaining({
      url: service.wallpapers.dashboard[1].url,
      active: true
    }));
  }));

  it('removes inactive wallpaper layers after the crossfade cleanup delay', fakeAsync(() => {
    const service = TestBed.inject(WallpaperService);

    tick(30000);
    tick();
    flushMicrotasks();
    expect(service.visibleLayers().length).toBe(2);

    tick(2850);

    expect(service.visibleLayers()).toEqual([
      jasmine.objectContaining({
        url: service.wallpapers.dashboard[1].url,
        active: true
      }) as never
    ]);
  }));

  it('skips failed wallpapers during rotation and remembers the failed URL', fakeAsync(() => {
    const service = TestBed.inject(WallpaperService);
    MockImage.failedUrls.add(service.wallpapers.dashboard[1].url);

    tick(30000);
    tick();
    flushMicrotasks();
    tick();
    flushMicrotasks();

    const activeLayer = service.visibleLayers().find((layer) => layer.active);
    expect(activeLayer?.url).toBe(service.wallpapers.dashboard[2].url);
  }));

  it('clears wallpaper state when navigating to a route without wallpaper support', fakeAsync(() => {
    const service = TestBed.inject(WallpaperService);

    events.next(new NavigationEnd(2, '/calendar', '/calendar'));
    tick();

    expect(service.currentPage()).toBeNull();
    expect(service.hasWallpaper()).toBeFalse();
    expect(service.visibleLayers()).toEqual([]);
    expect(service.currentHero()).toBeNull();
  }));

  it('resolves route helpers for nested feature routes', () => {
    const service = TestBed.inject(WallpaperService);
    const resolvePage = (service as unknown as { resolvePage: (url: string) => string | null }).resolvePage.bind(service);

    expect(resolvePage('/trips/create/flights?step=2')).toBe('flights');
    expect(resolvePage('/trips/create/hotels#results')).toBe('hotels');
    expect(resolvePage('/trips/create/activities')).toBe('activities');
    expect(resolvePage('/trips/create/budget')).toBe('budget');
    expect(resolvePage('/budget-tracker')).toBe('budget');
    expect(resolvePage('/calendar')).toBeNull();
    expect(resolvePage('/settings')).toBeNull();
    expect(resolvePage('/unknown')).toBeNull();
  });

  it('builds wallpaper image URLs with shared Unsplash parameters', () => {
    const service = TestBed.inject(WallpaperService);

    expect(service.wallpapers.settings[0].url).toBe(
      'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=2880&q=96'
    );
  });

  it('keeps wallpaper selection independent of light or dark theme state', fakeAsync(() => {
    document.documentElement.setAttribute('data-theme', 'light');
    const lightService = TestBed.inject(WallpaperService);
    tick();
    const lightUrl = lightService.visibleLayers()[0].url;
    (lightService as unknown as { stopRotation: () => void }).stopRotation();

    TestBed.resetTestingModule();
    events = new Subject<NavigationEnd>();
    router = {
      url: '/dashboard',
      events
    };
    TestBed.configureTestingModule({
      providers: [
        WallpaperService,
        { provide: Router, useValue: router }
      ]
    });

    document.documentElement.setAttribute('data-theme', 'dark');
    const darkService = TestBed.inject(WallpaperService);
    tick();

    expect(darkService.visibleLayers()[0].url).toBe(lightUrl);
  }));

  it('uses Math.random only to choose the initial wallpaper index', fakeAsync(() => {
    randomSpy.and.returnValue(0.5);
    const service = TestBed.inject(WallpaperService);
    tick();

    const expectedIndex = Math.floor(0.5 * service.wallpapers.dashboard.length);
    expect(service.visibleLayers()[0].url).toBe(service.wallpapers.dashboard[expectedIndex].url);
  }));
});
