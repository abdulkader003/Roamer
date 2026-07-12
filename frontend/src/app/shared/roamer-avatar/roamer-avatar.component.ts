import { ChangeDetectorRef, Component, ElementRef, HostListener, Input, NgZone, OnDestroy, OnInit } from '@angular/core';

type AvatarMood = 'idle' | 'password-hidden' | 'password-visible';

@Component({
  selector: 'app-roamer-avatar',
  standalone: true,
  templateUrl: './roamer-avatar.component.html',
  styleUrl: './roamer-avatar.component.css'
})
export class RoamerAvatarComponent implements OnDestroy, OnInit {
  pupilOffsetX = 0;
  pupilOffsetY = 0;
  isBlinking = false;
  private currentMood: AvatarMood = 'idle';
  private hasStartedBlinking = false;

  private readonly maxPupilOffsetX = 6;
  private readonly maxPupilOffsetY = 4.5;
  private readonly minBlinkDelayMs = 4000;
  private readonly maxBlinkDelayMs = 7000;
  private readonly blinkDurationMs = 150;
  private animationFrameId: number | null = null;
  private pendingPointer: PointerEvent | null = null;
  private blinkTimeoutId: ReturnType<typeof window.setTimeout> | null = null;
  private blinkEndTimeoutId: ReturnType<typeof window.setTimeout> | null = null;

  constructor(
    private readonly elementRef: ElementRef<HTMLElement>,
    private readonly changeDetectorRef: ChangeDetectorRef,
    private readonly ngZone: NgZone
  ) {}

  @Input()
  set mood(value: AvatarMood) {
    this.currentMood = value;

    if (value === 'password-visible') {
      this.resetPupilOffset();
      this.stopBlinking();
      return;
    }

    if (this.hasStartedBlinking && this.blinkTimeoutId === null && this.blinkEndTimeoutId === null) {
      this.scheduleNextBlink();
    }
  }

  get mood(): AvatarMood {
    return this.currentMood;
  }

  get eyelidsClosed(): boolean {
    return this.currentMood === 'password-visible' || this.isBlinking;
  }

  @HostListener('window:pointermove', ['$event'])
  onPointerMove(event: PointerEvent): void {
    if (this.currentMood === 'password-visible') {
      this.resetPupilOffset();
      return;
    }

    this.pendingPointer = event;

    if (this.animationFrameId !== null) {
      return;
    }

    this.animationFrameId = window.requestAnimationFrame(() => {
      const pointer = this.pendingPointer;
      this.animationFrameId = null;

      if (pointer) {
        this.updatePupilOffset(pointer.clientX, pointer.clientY);
      }
    });
  }

  ngOnInit(): void {
    this.hasStartedBlinking = true;
    this.scheduleNextBlink();
  }

  @HostListener('document:mouseleave')
  @HostListener('window:blur')
  resetPupilOffset(): void {
    this.pendingPointer = null;
    this.pupilOffsetX = 0;
    this.pupilOffsetY = 0;
  }

  ngOnDestroy(): void {
    if (this.animationFrameId !== null) {
      window.cancelAnimationFrame(this.animationFrameId);
    }

    this.clearBlinkTimers();
  }

  private updatePupilOffset(pointerX: number, pointerY: number): void {
    const avatarBounds = this.elementRef.nativeElement.getBoundingClientRect();

    if (!avatarBounds.width || !avatarBounds.height) {
      this.resetPupilOffset();
      return;
    }

    const eyeCenterX = avatarBounds.left + avatarBounds.width * 0.5;
    const eyeCenterY = avatarBounds.top + avatarBounds.height * 0.38;
    const normalizedX = (pointerX - eyeCenterX) / (avatarBounds.width * 0.5);
    const normalizedY = (pointerY - eyeCenterY) / (avatarBounds.height * 0.5);

    this.pupilOffsetX = this.clamp(normalizedX, -1, 1) * this.maxPupilOffsetX;
    this.pupilOffsetY = this.clamp(normalizedY, -1, 1) * this.maxPupilOffsetY;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }

  private scheduleNextBlink(): void {
    if (this.blinkTimeoutId !== null || this.currentMood === 'password-visible') {
      return;
    }

    const delay = this.randomBetween(this.minBlinkDelayMs, this.maxBlinkDelayMs);

    this.ngZone.runOutsideAngular(() => {
      this.blinkTimeoutId = window.setTimeout(() => {
        this.blinkTimeoutId = null;
        this.startBlink();
      }, delay);
    });
  }

  private startBlink(): void {
    if (this.currentMood === 'password-visible') {
      this.scheduleNextBlink();
      return;
    }

    this.ngZone.run(() => {
      this.isBlinking = true;
      this.changeDetectorRef.detectChanges();
    });

    this.clearBlinkTimeout(this.blinkEndTimeoutId);
    this.ngZone.runOutsideAngular(() => {
      this.blinkEndTimeoutId = window.setTimeout(() => {
        this.blinkEndTimeoutId = null;

        this.ngZone.run(() => {
          this.isBlinking = false;
          this.changeDetectorRef.detectChanges();
        });

        this.scheduleNextBlink();
      }, this.blinkDurationMs);
    });
  }

  private stopBlinking(): void {
    this.isBlinking = false;
    this.clearBlinkTimers();
  }

  private clearBlinkTimers(): void {
    this.clearBlinkTimeout(this.blinkTimeoutId);
    this.clearBlinkTimeout(this.blinkEndTimeoutId);
    this.blinkTimeoutId = null;
    this.blinkEndTimeoutId = null;
  }

  private clearBlinkTimeout(timeoutId: ReturnType<typeof window.setTimeout> | null): void {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
    }
  }

  private randomBetween(min: number, max: number): number {
    return Math.round(min + Math.random() * (max - min));
  }
}
