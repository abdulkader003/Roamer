import { Injectable, NgZone, computed, inject, signal } from '@angular/core';
import { AuthService } from './auth';
import { ProfileService, UserProfile } from './profile.service';

@Injectable({
  providedIn: 'root'
})
export class ProfileStateService {
  private readonly authService = inject(AuthService);
  private readonly profileService = inject(ProfileService);
  private readonly zone = inject(NgZone);
  private activePictureUrl = '';
  private loadedForEmail = '';
  private loadedPictureVersion = '';
  private profileRequestRunning = false;
  private pictureRequestRunning = false;

  readonly profile = signal<UserProfile | null>(null);
  readonly pictureUrl = signal('');
  readonly isProfileLoading = signal(false);
  readonly isPictureLoading = signal(false);
  readonly loadError = signal('');

  readonly displayName = computed(() => {
    const profile = this.profile();
    const fullName = [profile?.firstName, profile?.lastName]
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(' ');

    return fullName || profile?.username || profile?.email || 'Account';
  });

  readonly avatarInitials = computed(() => {
    const profile = this.profile();
    const source = this.displayName() || profile?.email || this.authService.email() || 'RO';

    return source
      .split(/[\s@._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'RO';
  });

  loadCurrentProfile(force = false): void {
    const email = this.authService.email();

    if (!this.authService.isAuthenticated()) {
      this.clear();
      return;
    }

    if (this.profileRequestRunning) {
      return;
    }

    if (!force && this.loadedForEmail === email && this.profile()) {
      return;
    }

    this.profileRequestRunning = true;
    this.isProfileLoading.set(true);
    this.loadError.set('');

    this.profileService.getProfile()
      .subscribe({
        next: (profile) => this.renderNow(() => {
          if (this.authService.isAuthenticated()) {
            this.setProfile(profile);
          }
          this.profileRequestRunning = false;
          this.isProfileLoading.set(false);
        }),
        error: (error) => this.renderNow(() => {
          this.loadError.set(this.extractErrorMessage(error, 'Could not load your profile.'));
          this.profileRequestRunning = false;
          this.isProfileLoading.set(false);
        })
      });
  }

  setProfile(profile: UserProfile): void {
    this.profile.set(profile);
    this.loadedForEmail = profile.email || this.authService.email();
    this.loadError.set('');

    if (profile.hasProfilePicture) {
      this.loadProfilePicture(profile.profilePictureUpdatedAt || 'current');
      return;
    }

    this.clearPictureUrl();
  }

  loadProfilePicture(version = 'current', force = false): void {
    if (this.pictureRequestRunning || (!force && this.pictureUrl() && this.loadedPictureVersion === version)) {
      return;
    }

    this.pictureRequestRunning = true;
    this.isPictureLoading.set(true);

    this.profileService.getProfilePicture()
      .subscribe({
        next: (blob) => this.renderNow(() => {
          if (!this.authService.isAuthenticated()) {
            this.pictureRequestRunning = false;
            this.isPictureLoading.set(false);
            return;
          }

          this.clearPictureUrl();
          this.activePictureUrl = URL.createObjectURL(blob);
          this.loadedPictureVersion = version;
          this.pictureUrl.set(this.activePictureUrl);
          this.pictureRequestRunning = false;
          this.isPictureLoading.set(false);
        }),
        error: () => this.renderNow(() => {
          this.clearPictureUrl();
          this.pictureRequestRunning = false;
          this.isPictureLoading.set(false);
        })
      });
  }

  clearPictureUrl(): void {
    if (this.activePictureUrl) {
      URL.revokeObjectURL(this.activePictureUrl);
      this.activePictureUrl = '';
    }

    this.loadedPictureVersion = '';
    this.pictureUrl.set('');
  }

  clear(): void {
    this.profile.set(null);
    this.loadedForEmail = '';
    this.loadError.set('');
    this.isProfileLoading.set(false);
    this.isPictureLoading.set(false);
    this.profileRequestRunning = false;
    this.pictureRequestRunning = false;
    this.clearPictureUrl();
  }

  private extractErrorMessage(error: unknown, fallback: string): string {
    const body = (error as { error?: unknown }).error;

    if (body && typeof body === 'object') {
      const messageBody = body as { message?: string; detail?: string; title?: string };
      return messageBody.message || messageBody.detail || messageBody.title || fallback;
    }

    if (typeof body === 'string' && body.trim()) {
      return body;
    }

    return fallback;
  }

  private renderNow(update: () => void): void {
    this.zone.run(update);
  }
}
