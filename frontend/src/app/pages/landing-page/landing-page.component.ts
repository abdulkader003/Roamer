import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  NgZone,
  OnDestroy,
  ViewChild,
  computed,
  inject
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './landing-page.component.html',
  styleUrl: './landing-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LandingPageComponent implements AfterViewInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly zone = inject(NgZone);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly authService = inject(AuthService);
  private readonly themeService = inject(ThemeService);

  readonly isAuthenticated = computed(() => this.authService.isAuthenticated());
  readonly isDark = computed(() => this.themeService.resolvedTheme() === 'dark');

  @ViewChild('heroVideo')
  private readonly heroVideo?: ElementRef<HTMLVideoElement>;

  isVideoReady = false;
  isPhotoVisible = false;
  isLeaving = false;

  private readonly bottomEnterOffset = 96;
  private hasEnteredApp = false;
  private scrollFrame = 0;
  private scrollAnimationFrame = 0;
  private readyFallbackTimer = 0;

  ngAfterViewInit(): void {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    this.prepareVideoElement();

    this.zone.runOutsideAngular(() => {
      this.readyFallbackTimer = window.setTimeout(() => {
        if (!this.isVideoReady) {
          this.zone.run(() => this.markVideoReady());
        }
      }, 1200);
    });
  }

  ngOnDestroy(): void {
    if (this.scrollFrame) {
      window.cancelAnimationFrame(this.scrollFrame);
    }

    if (this.scrollAnimationFrame) {
      window.cancelAnimationFrame(this.scrollAnimationFrame);
    }

    if (this.readyFallbackTimer) {
      window.clearTimeout(this.readyFallbackTimer);
    }
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    if (this.scrollFrame) {
      return;
    }

    this.scrollFrame = window.requestAnimationFrame(() => {
      this.scrollFrame = 0;
      this.checkEnterThreshold();
    });
  }

  @HostListener('window:keydown', ['$event'])
  onWindowKeydown(event: KeyboardEvent): void {
    const scrollKeys = new Set(['ArrowDown', 'PageDown', 'Space']);

    if (scrollKeys.has(event.code)) {
      event.preventDefault();
      this.scrollTowardRoamer();
    }
  }

  scrollTowardRoamer(): void {
    this.smoothScrollTo(this.getStoryStartY());
  }

  toggleTheme(): void {
    this.themeService.toggle();
  }

  enterRoamer(): void {
    if (this.hasEnteredApp) {
      return;
    }

    this.hasEnteredApp = true;
    this.isLeaving = true;
    this.stopScrollAnimation();
    this.resetWindowScroll();
    this.cdr.markForCheck();

    window.setTimeout(() => {
      this.zone.run(() => {
        void this.router.navigateByUrl('/dashboard').then(() => {
          this.resetWindowScroll();
        });
      });
    }, 360);
  }

  onVideoLoaded(): void {
    const video = this.prepareVideoElement();
    this.markVideoReady();

    void video?.play().catch(() => this.markVideoReady());
  }

  onVideoEnded(): void {
    this.showPhoto();
  }

  onVideoError(): void {
    this.showPhoto();
  }

  private checkEnterThreshold(): void {
    if (this.hasEnteredApp || this.isLeaving) {
      return;
    }

    const maxScrollY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);

    if (maxScrollY > 0 && window.scrollY >= maxScrollY - this.bottomEnterOffset) {
      this.enterRoamer();
    }
  }

  private getStoryStartY(): number {
    const storySection = document.querySelector<HTMLElement>('.landing-story');

    return storySection?.offsetTop ?? window.innerHeight;
  }

  private markVideoReady(): void {
    this.isVideoReady = true;
    this.cdr.markForCheck();
  }

  private prepareVideoElement(): HTMLVideoElement | undefined {
    const video = this.heroVideo?.nativeElement;

    if (!video) {
      return undefined;
    }

    video.muted = true;
    video.defaultMuted = true;
    video.volume = 0;
    video.playsInline = true;

    return video;
  }

  private showPhoto(): void {
    this.isPhotoVisible = true;
    this.markVideoReady();
  }

  private smoothScrollTo(targetY: number): void {
    this.stopScrollAnimation();

    const startY = window.scrollY;
    const distance = targetY - startY;
    const duration = 950;
    const startedAt = window.performance.now();

    const animate = (now: number) => {
      const elapsed = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - elapsed, 3);

      window.scrollTo(0, startY + distance * eased);

      if (elapsed < 1) {
        this.scrollAnimationFrame = window.requestAnimationFrame(animate);
        return;
      }

      this.scrollAnimationFrame = 0;
    };

    this.scrollAnimationFrame = window.requestAnimationFrame(animate);
  }

  private stopScrollAnimation(): void {
    if (!this.scrollAnimationFrame) {
      return;
    }

    window.cancelAnimationFrame(this.scrollAnimationFrame);
    this.scrollAnimationFrame = 0;
  }

  private resetWindowScroll(): void {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }
}
