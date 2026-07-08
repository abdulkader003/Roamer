import { Injectable, computed, effect, signal } from '@angular/core';

export type Theme = 'light' | 'dark';
export type ThemePreference = Theme | 'system';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly STORAGE_KEY = 'roamer-theme';
  private readonly systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
  private readonly systemTheme = signal<Theme>(this.getSystemTheme());

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

  private getSystemTheme(): Theme {
    return this.systemThemeQuery.matches ? 'dark' : 'light';
  }

  private readonly handleSystemThemeChange = (event: MediaQueryListEvent): void => {
    this.systemTheme.set(event.matches ? 'dark' : 'light');
  };
}
