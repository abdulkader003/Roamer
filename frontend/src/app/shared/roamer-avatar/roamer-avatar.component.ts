import { Component, ElementRef, HostListener, Input, OnDestroy } from '@angular/core';

type AvatarMood = 'idle' | 'password-hidden' | 'password-visible';

@Component({
  selector: 'app-roamer-avatar',
  standalone: true,
  templateUrl: './roamer-avatar.component.html',
  styleUrl: './roamer-avatar.component.css'
})
export class RoamerAvatarComponent implements OnDestroy {
  pupilOffsetX = 0;
  pupilOffsetY = 0;
  private currentMood: AvatarMood = 'idle';

  private readonly maxPupilOffsetX = 6;
  private readonly maxPupilOffsetY = 4.5;
  private animationFrameId: number | null = null;
  private pendingPointer: PointerEvent | null = null;

  constructor(private readonly elementRef: ElementRef<HTMLElement>) {}

  @Input()
  set mood(value: AvatarMood) {
    this.currentMood = value;

    if (value === 'password-hidden') {
      this.resetPupilOffset();
    }
  }

  get mood(): AvatarMood {
    return this.currentMood;
  }

  @HostListener('window:pointermove', ['$event'])
  onPointerMove(event: PointerEvent): void {
    if (this.currentMood === 'password-hidden') {
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
}
