import { NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, HostListener, computed, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from './shared/sidebar/sidebar.component';
import { NavbarComponent } from './shared/navbar/navbar.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [NgIf, RouterOutlet, SidebarComponent, NavbarComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  private readonly mobileBreakpoint = 900;
  private touchStartX = 0;
  private touchStartY = 0;

  readonly isMobile = signal(false);
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
    const isMobile = window.innerWidth <= this.mobileBreakpoint;
    const previousIsMobile = this.isMobile();

    this.isMobile.set(isMobile);

    if (!isMobile) {
      this.isSidebarOpen.set(true);
      return;
    }

    if (previousIsMobile !== isMobile) {
      this.isSidebarOpen.set(false);
    }
  }
}
