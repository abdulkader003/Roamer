import { NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, HostListener, computed, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from './shared/sidebar/sidebar.component';
import { NavbarComponent } from './shared/navbar/navbar.component';
import { WallpaperLayer, WallpaperService } from './services/wallpaper.service';
import { ThemeService } from './services/theme.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [NgIf, RouterOutlet, SidebarComponent, NavbarComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  readonly wallpaperService = inject(WallpaperService);
  private readonly themeService = inject(ThemeService);
  private readonly mobileBreakpoint = 900;
  private readonly tabletBreakpoint = 1200;
  private touchStartX = 0;
  private touchStartY = 0;

  readonly isMobile = signal(false);
  readonly isTablet = signal(false);
  readonly isSidebarOpen = signal(true);
  readonly isSidebarVisible = computed(() => !this.isMobile() || this.isSidebarOpen());

  constructor() {
    this.updateViewportState();
  }

  @HostListener('window:resize')
  onResize(): void {
    this.updateViewportState();
  }

  toggleSidebar(): void {
    if (this.isMobile()) {
      this.isSidebarOpen.update((isOpen) => !isOpen);
    }
  }

  closeSidebar(): void {
    if (this.isMobile()) {
      this.isSidebarOpen.set(false);
    }
  }

  heroLayerPosition(layer: WallpaperLayer): string {
    if (this.isMobile()) {
      return layer.mobilePosition ?? layer.tabletPosition ?? layer.desktopPosition ?? layer.position;
    }

    if (this.isTablet()) {
      return layer.tabletPosition ?? layer.desktopPosition ?? layer.position;
    }

    return layer.desktopPosition ?? layer.position;
  }

  heroLayerSize(layer: WallpaperLayer): string {
    if (this.isMobile()) {
      return layer.mobileBackgroundSize
        ?? layer.tabletBackgroundSize
        ?? layer.desktopBackgroundSize
        ?? layer.backgroundSize;
    }

    if (this.isTablet()) {
      return layer.tabletBackgroundSize ?? layer.desktopBackgroundSize ?? layer.backgroundSize;
    }

    return layer.desktopBackgroundSize ?? layer.backgroundSize;
  }

  heroLayerStartScale(layer: WallpaperLayer): string {
    const scale = this.isMobile()
      ? layer.mobileStartScale ?? layer.tabletStartScale ?? layer.desktopStartScale ?? layer.startScale
      : this.isTablet()
        ? layer.tabletStartScale ?? layer.desktopStartScale ?? layer.startScale
        : layer.desktopStartScale ?? layer.startScale;

    return String(scale);
  }

  heroLayerEndScale(layer: WallpaperLayer): string {
    const scale = this.isMobile()
      ? layer.mobileScale ?? layer.tabletScale ?? layer.desktopScale ?? layer.scale
      : this.isTablet()
        ? layer.tabletScale ?? layer.desktopScale ?? layer.scale
        : layer.desktopScale ?? layer.scale;

    return String(scale);
  }

  handleTouchStart(event: TouchEvent): void {
    const touch = event.changedTouches[0];
    this.touchStartX = touch.clientX;
    this.touchStartY = touch.clientY;
  }

  handleTouchEnd(event: TouchEvent): void {
    if (!this.isMobile()) {
      return;
    }

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - this.touchStartX;
    const deltaY = touch.clientY - this.touchStartY;

    if (Math.abs(deltaX) < 72 || Math.abs(deltaX) < Math.abs(deltaY)) {
      return;
    }

    if (!this.isSidebarOpen() && this.touchStartX <= 28 && deltaX > 0) {
      this.isSidebarOpen.set(true);
    }

    if (this.isSidebarOpen() && deltaX < -72) {
      this.isSidebarOpen.set(false);
    }
  }

  private updateViewportState(): void {
    const viewportWidth = window.innerWidth;
    const isMobile = viewportWidth <= this.mobileBreakpoint;
    const previousIsMobile = this.isMobile();

    this.isMobile.set(isMobile);
    this.isTablet.set(viewportWidth > this.mobileBreakpoint && viewportWidth <= this.tabletBreakpoint);

    if (!isMobile) {
      this.isSidebarOpen.set(true);
      return;
    }

    if (previousIsMobile !== isMobile) {
      this.isSidebarOpen.set(false);
    }
  }
}
