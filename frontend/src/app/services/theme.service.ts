import { Injectable, OnDestroy, computed, effect, signal } from '@angular/core';

export type Theme = 'light' | 'dark';
export type ThemePreference = Theme | 'system';

export function resolveSystemTheme(query: Pick<MediaQueryList, 'matches'>): Theme {
  return query.matches ? 'dark' : 'light';
}

@Injectable({ providedIn: 'root' })
export class ThemeService implements OnDestroy {
  private readonly STORAGE_KEY = 'roamer-theme';
  private readonly systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
  private readonly systemTheme = signal<Theme>(resolveSystemTheme(this.systemThemeQuery));

  theme = signal<ThemePreference>(this.loadTheme());
  resolvedTheme = computed<Theme>(() => {
    const theme = this.theme();
    return theme === 'system' ? this.systemTheme() : theme;
  });

  constructor() {
    this.systemThemeQuery.addEventListener('change', this.handleSystemThemeChange);

    effect(() => {
      document.documentElement.setAttribute('data-theme', this.resolvedTheme());
      localStorage.setItem(this.STORAGE_KEY, this.theme());
    });
  }

  ngOnDestroy(): void {
    this.systemThemeQuery.removeEventListener('change', this.handleSystemThemeChange);
  }

  toggle(): void {
    this.theme.set(this.resolvedTheme() === 'dark' ? 'light' : 'dark');
  }

  setTheme(theme: ThemePreference): void {
    this.theme.set(theme);
  }

  private loadTheme(): ThemePreference {
    const stored = localStorage.getItem(this.STORAGE_KEY) as ThemePreference | null;
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
    return 'light';
  }

  private readonly handleSystemThemeChange = (event: MediaQueryListEvent): void => {
    this.systemTheme.set(resolveSystemTheme(event));
  };
}
