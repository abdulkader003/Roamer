import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectorRef, Component, DestroyRef, NgZone, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { AirportOption, AirportOptionsService } from '../../services/airport-options.service';
import { AuthService } from '../../services/auth';
import {
  FriendCommunityService,
  FriendItem,
  FriendRequestItem,
  FriendSearchResult,
  FriendUserSummary
} from '../../services/friend-community.service';
import { FriendNotificationService } from '../../services/friend-notification.service';
import {
  ProfileService,
  UpdateProfileRequest,
  UserProfile
} from '../../services/profile.service';
import { ProfileStateService } from '../../services/profile-state.service';
import { TripPlanningService, TripResponse } from '../../services/trip-planning.service';
import { WorldTravelMapComponent } from './world-travel-map.component';

type TravelAchievementOption = {
  key: string;
  label: string;
};

type ProfileLevelSummary = {
  level: number;
  title: string;
  totalXp: number;
  currentLevelXp: number;
  nextLevelXp: number;
  progressPercent: number;
  xpIntoLevel: number;
  xpNeededForNextLevel: number;
};

type XpHint = {
  label: string;
  points: number;
};

const TRAVEL_ACHIEVEMENTS: TravelAchievementOption[] = [
  { key: 'BEACH_LOVER', label: '🏖 Beach Lover' },
  { key: 'MOUNTAIN_EXPLORER', label: '🏔 Mountain Explorer' },
  { key: 'FREQUENT_FLYER', label: '✈️ Frequent Flyer' },
  { key: 'WORLD_TRAVELER', label: '🌍 World Traveler' },
  { key: 'CULTURE_SEEKER', label: '🏛 Culture Seeker' },
  { key: 'FOOD_EXPLORER', label: '🍜 Food Explorer' },
  { key: 'BACKPACKER', label: '🎒 Backpacker' },
  { key: 'RELAXATION_TRAVELER', label: '🧘 Relaxation Traveler' },
  { key: 'TRAVEL_PHOTOGRAPHER', label: '📸 Travel Photographer' },
  { key: 'NATURE_EXPLORER', label: '🌿 Nature Explorer' }
];

const PROFILE_LEVEL_THRESHOLDS = [0, 250, 600, 1000, 1500, 2200, 3000, 4000];
const PROFILE_LEVEL_TITLES = [
  'New Explorer',
  'Weekend Planner',
  'Route Builder',
  'Globe Scout',
  'Journey Pro',
  'World Voyager',
  'Roamer Elite',
  'Legend Traveler'
];

const PROFILE_XP_HINTS: XpHint[] = [
  { label: 'Verify your account', points: 100 },
  { label: 'Upload a profile picture', points: 75 },
  { label: 'Complete each profile field', points: 35 },
  { label: 'Select each travel interest', points: 45 },
  { label: 'Add a visited country', points: 60 },
  { label: 'Plan or confirm an upcoming trip', points: 120 },
  { label: 'Connect with another traveler', points: 40 },
];

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, WorldTravelMapComponent],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss'
})
export class ProfileComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly profileService = inject(ProfileService);
  private readonly friendCommunityService = inject(FriendCommunityService);
  private readonly friendNotificationService = inject(FriendNotificationService);
  private readonly profileState = inject(ProfileStateService);
  private readonly airportOptions = inject(AirportOptionsService);
  private readonly tripPlanningService = inject(TripPlanningService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly zone = inject(NgZone);
  private readonly cdr = inject(ChangeDetectorRef);

  profile: UserProfile | null = null;
  isLoading = true;
  isSavingProfile = false;
  isUploadingPicture = false;
  isDeletingPicture = false;
  isChangingPassword = false;
  isDeleteDialogOpen = false;
  isDeletingAccount = false;
  isAirportPickerOpen = false;
  isAirportSearching = false;
  showCurrentPassword = false;
  showNewPassword = false;
  showConfirmPassword = false;
  profileError = '';
  profileSuccess = '';
  pictureError = '';
  passwordError = '';
  passwordSuccess = '';
  deleteError = '';
  airportSearchMessage = '';
  airportSuggestions: AirportOption[] = [];
  visitedCountries: string[] = [];
  upcomingTripCountries: string[] = [];
  selectedTravelAchievements: string[] = [];
  friendSearchResults: FriendSearchResult[] = [];
  incomingFriendRequests: FriendRequestItem[] = [];
  friends: FriendItem[] = [];
  isLoadingUpcomingCountries = false;
  isLoadingFriendSearch = false;
  isLoadingIncomingFriendRequests = false;
  isLoadingFriends = false;
  upcomingCountriesError = '';
  friendSearchError = '';
  friendCommunityError = '';
  upcomingTripCount = 0;
  isXpHintOpen = false;
  private selectedHomeAirport: AirportOption | null = null;

  readonly maxPictureSizeMb = 2;
  readonly travelAchievementOptions = TRAVEL_ACHIEVEMENTS;
  readonly profileXpHints = PROFILE_XP_HINTS;
  readonly friendSearchControl = this.fb.nonNullable.control('');

  readonly profileForm = this.fb.nonNullable.group({
    username: ['', [
      Validators.required,
      Validators.minLength(3),
      Validators.maxLength(40),
      Validators.pattern(/^[A-Za-z0-9._-]+$/)
    ]],
    firstName: ['', [Validators.maxLength(80)]],
    lastName: ['', [Validators.maxLength(80)]],
    phoneNumber: ['', [
      Validators.pattern(/^[+0-9 ()-]*$/),
      Validators.maxLength(30)
    ]],
    homeAirport: ['', [Validators.maxLength(120)]]
  });

  readonly passwordForm = this.fb.nonNullable.group({
    currentPassword: ['', [Validators.required]],
    newPassword: ['', [
      Validators.required,
      Validators.minLength(8),
      Validators.maxLength(72)
    ]],
    confirmPassword: ['', [Validators.required]]
  }, {
    validators: this.passwordMatchValidator()
  });

  readonly deleteAccountForm = this.fb.nonNullable.group({
    currentPassword: ['', [Validators.required]]
  });

  ngOnInit(): void {
    this.setupAirportSearch();
    this.setupFriendSearch();
    this.loadProfile();
    this.loadUpcomingTripCountries();
    this.loadFriendCommunity();
    this.route.fragment
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((fragment) => this.focusFriendSearchFromFragment(fragment));
  }

  get profileImageUrl(): string {
    return this.profileState.pictureUrl();
  }

  get isPictureLoading(): boolean {
    return this.profileState.isPictureLoading();
  }

  get displayName(): string {
    const firstName = this.profile?.firstName?.trim();
    const lastName = this.profile?.lastName?.trim();
    const fullName = [firstName, lastName].filter(Boolean).join(' ');

    return fullName || this.profile?.username || 'Your profile';
  }

  get avatarInitials(): string {
    const source = this.displayName || this.profile?.email || 'RO';
    return source
      .split(/[\s@._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'RO';
  }

  get profileLevelSummary(): ProfileLevelSummary {
    const totalXp = this.profileXpPoints;
    const normalizedLevelIndex = PROFILE_LEVEL_THRESHOLDS
      .reduce((levelIndex, threshold, index) => totalXp >= threshold ? index : levelIndex, 0);
    const currentLevelXp = PROFILE_LEVEL_THRESHOLDS[normalizedLevelIndex] ?? 0;
    const nextLevelXp = PROFILE_LEVEL_THRESHOLDS[normalizedLevelIndex + 1] ?? currentLevelXp;
    const xpRange = Math.max(1, nextLevelXp - currentLevelXp);
    const xpIntoLevel = Math.max(0, totalXp - currentLevelXp);
    const isMaxLevel = normalizedLevelIndex >= PROFILE_LEVEL_THRESHOLDS.length - 1;

    return {
      level: normalizedLevelIndex + 1,
      title: PROFILE_LEVEL_TITLES[normalizedLevelIndex] ?? PROFILE_LEVEL_TITLES.at(-1) ?? 'Traveler',
      totalXp,
      currentLevelXp,
      nextLevelXp,
      progressPercent: isMaxLevel ? 100 : Math.min(100, Math.round((xpIntoLevel / xpRange) * 100)),
      xpIntoLevel,
      xpNeededForNextLevel: isMaxLevel ? 0 : Math.max(0, nextLevelXp - totalXp),
    };
  }

  get profileXpPoints(): number {
    const profile = this.profile;

    if (!profile) {
      return 0;
    }

    const completedProfileFields = [
      profile.username,
      profile.firstName,
      profile.lastName,
      profile.phoneNumber,
      profile.homeAirport,
    ].filter((value) => Boolean(value?.trim())).length;

    const verifiedXp = profile.verified ? 100 : 0;
    const pictureXp = profile.hasProfilePicture ? 75 : 0;
    const profileFieldsXp = completedProfileFields * 35;
    const interestsXp = this.selectedTravelAchievements.length * 45;
    const visitedCountriesXp = this.visitedCountries.length * 60;
    const upcomingTripsXp = this.upcomingTripCount * 120;
    const friendsXp = this.friends.length * 40;

    return verifiedXp + pictureXp + profileFieldsXp + interestsXp + visitedCountriesXp + upcomingTripsXp + friendsXp;
  }

  get profileLevelMilestones(): number[] {
    return PROFILE_LEVEL_THRESHOLDS.slice(0, 6);
  }

  achievementLabel(key: string): string {
    return this.travelAchievementOptions.find((option) => option.key === key)?.label ?? key;
  }

  toggleXpHint(): void {
    this.isXpHintOpen = !this.isXpHintOpen;
  }

  loadProfile(): void {
    this.isLoading = true;
    this.profileError = '';
    this.profileSuccess = '';
    this.refreshView();

    this.profileService.getProfile()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (profile) => this.renderNow(() => {
          this.applyProfile(profile);
          this.isLoading = false;
          this.focusFriendSearchFromFragment(this.route.snapshot.fragment);
        }),
        error: (error) => this.renderNow(() => {
          this.profileError = this.extractErrorMessage(error, 'Could not load your profile.');
          this.isLoading = false;
        })
      });
  }

  loadUpcomingTripCountries(): void {
    this.isLoadingUpcomingCountries = true;
    this.upcomingCountriesError = '';
    this.refreshView();

    this.tripPlanningService.listSavedTrips()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (trips) => {
          const upcomingTrips = trips.filter((trip) => this.isUpcomingTrip(trip));
          const candidates = upcomingTrips.flatMap((trip) => this.tripDestinationCandidates(trip));

          void import('./travel-country-data')
            .then(({ resolveCountryName, uniqueCountries }) => this.renderNow(() => {
              const countries = candidates
                .map((candidate) => resolveCountryName(candidate))
                .filter((country): country is string => Boolean(country));

              this.upcomingTripCount = upcomingTrips.length;
              this.upcomingTripCountries = uniqueCountries(countries);
              this.isLoadingUpcomingCountries = false;
            }))
            .catch(() => this.renderNow(() => {
              this.upcomingCountriesError = 'Could not load upcoming trip countries.';
              this.upcomingTripCountries = [];
              this.upcomingTripCount = 0;
              this.isLoadingUpcomingCountries = false;
            }));
        },
        error: () => this.renderNow(() => {
          this.upcomingCountriesError = 'Could not load upcoming trip countries.';
          this.upcomingTripCountries = [];
          this.upcomingTripCount = 0;
          this.isLoadingUpcomingCountries = false;
        })
      });
  }

  loadFriendCommunity(): void {
    this.friendCommunityError = '';
    this.loadIncomingFriendRequests();
    this.loadFriends();
    this.loadFriendSearchResults(this.friendSearchControl.value);
  }

  saveProfile(): void {
    this.profileError = '';
    this.profileSuccess = '';

    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      this.profileError = 'Please check the highlighted profile fields.';
      return;
    }

    const homeAirportCode = this.resolveHomeAirportCodeForSave();
    if (homeAirportCode === null) {
      this.setHomeAirportError();
      this.profileForm.controls.homeAirport.markAsTouched();
      this.profileError = 'Choose a matching airport suggestion or enter a valid 3-letter IATA code.';
      return;
    }
    this.clearHomeAirportError();

    const formValue = this.profileForm.getRawValue();
    const request: UpdateProfileRequest = {
      username: formValue.username.trim(),
      firstName: formValue.firstName.trim(),
      lastName: formValue.lastName.trim(),
      phoneNumber: formValue.phoneNumber.trim(),
      travelAchievements: this.selectedTravelAchievements,
      homeAirport: homeAirportCode
    };

    this.isSavingProfile = true;
    this.refreshView();
    this.profileService.updateProfile(request)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (profile) => this.renderNow(() => {
          this.applyProfile(profile);
          this.isSavingProfile = false;
          this.profileSuccess = 'Profile updated successfully.';
        }),
        error: (error) => this.renderNow(() => {
          this.profileError = this.extractErrorMessage(error, 'Could not save your profile.');
          this.isSavingProfile = false;
        })
      });
  }

  onPictureSelected(event: Event): void {
    this.pictureError = '';
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.pictureError = 'Only image files are allowed.';
      input.value = '';
      return;
    }

    if (file.size > this.maxPictureSizeMb * 1024 * 1024) {
      this.pictureError = `Profile picture must be ${this.maxPictureSizeMb} MB or smaller.`;
      input.value = '';
      return;
    }

    this.isUploadingPicture = true;
    this.refreshView();
    this.profileService.uploadProfilePicture(file)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (profile) => this.renderNow(() => {
          this.applyProfile(profile);
          this.isUploadingPicture = false;
          input.value = '';
        }),
        error: (error) => this.renderNow(() => {
          this.pictureError = this.extractErrorMessage(error, 'Could not upload the profile picture.');
          this.isUploadingPicture = false;
          input.value = '';
        })
      });
  }

  deleteProfilePicture(): void {
    this.pictureError = '';
    this.isDeletingPicture = true;
    this.refreshView();

    this.profileService.deleteProfilePicture()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (profile) => this.renderNow(() => {
          this.applyProfile(profile);
          this.isDeletingPicture = false;
        }),
        error: (error) => this.renderNow(() => {
          this.pictureError = this.extractErrorMessage(error, 'Could not delete the profile picture.');
          this.isDeletingPicture = false;
        })
      });
  }

  onProfileImageError(): void {
    this.profileState.clearPictureUrl();
  }

  changePassword(): void {
    this.passwordError = '';
    this.passwordSuccess = '';

    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      this.passwordError = 'Please complete the password fields correctly.';
      return;
    }

    this.isChangingPassword = true;
    this.refreshView();
    this.profileService.changePassword(this.passwordForm.getRawValue())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => this.renderNow(() => {
          this.passwordForm.reset();
          this.isChangingPassword = false;
          this.passwordSuccess = response.message || 'Password changed successfully.';
        }),
        error: (error) => this.renderNow(() => {
          this.passwordError = this.extractErrorMessage(error, 'Could not change your password.');
          this.isChangingPassword = false;
        })
      });
  }

  openDeleteDialog(): void {
    this.deleteError = '';
    this.deleteAccountForm.reset();
    this.isDeleteDialogOpen = true;
  }

  closeDeleteDialog(): void {
    if (this.isDeletingAccount) {
      return;
    }

    this.isDeleteDialogOpen = false;
    this.deleteError = '';
  }

  deleteAccount(): void {
    this.deleteError = '';

    if (this.deleteAccountForm.invalid) {
      this.deleteAccountForm.markAllAsTouched();
      this.deleteError = 'Enter your current password to confirm deletion.';
      return;
    }

    this.isDeletingAccount = true;
    this.refreshView();
    this.profileService.deleteAccount(this.deleteAccountForm.getRawValue())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.renderNow(() => {
          this.isDeletingAccount = false;
          this.friendNotificationService.clear();
          this.profileState.clear();
          this.authService.logout();
          void this.router.navigate(['/login'], {
            queryParams: {
              message: 'Your account was deleted.'
            }
          });
        }),
        error: (error) => this.renderNow(() => {
          this.deleteError = this.extractErrorMessage(
            error,
            'Could not delete your account. Check your current password and try again.'
          );
          this.isDeletingAccount = false;
        })
      });
  }

  fieldHasError(controlName: 'username' | 'firstName' | 'lastName' | 'phoneNumber' | 'homeAirport'): boolean {
    const control = this.profileForm.controls[controlName];
    return control.invalid && (control.dirty || control.touched);
  }

  passwordFieldHasError(controlName: 'currentPassword' | 'newPassword' | 'confirmPassword'): boolean {
    const control = this.passwordForm.controls[controlName];
    return control.invalid && (control.dirty || control.touched);
  }

  passwordMismatchVisible(): boolean {
    const confirmPassword = this.passwordForm.controls.confirmPassword;
    return this.passwordForm.hasError('passwordMismatch') && (confirmPassword.dirty || confirmPassword.touched);
  }

  deleteFieldHasError(): boolean {
    const control = this.deleteAccountForm.controls.currentPassword;
    return control.invalid && (control.dirty || control.touched);
  }

  openAirportPicker(): void {
    this.isAirportPickerOpen = true;
    this.updateAirportSuggestions(this.profileForm.controls.homeAirport.value);
  }

  closeAirportPickerSoon(): void {
    window.setTimeout(() => this.renderNow(() => this.isAirportPickerOpen = false), 140);
  }

  selectHomeAirport(airport: AirportOption): void {
    this.selectedHomeAirport = airport;
    this.profileForm.controls.homeAirport.setValue(this.airportOptions.formatAirport(airport), { emitEvent: false });
    this.profileForm.controls.homeAirport.markAsDirty();
    this.profileForm.controls.homeAirport.markAsTouched();
    this.clearHomeAirportError();
    this.airportSuggestions = [];
    this.airportSearchMessage = '';
    this.isAirportPickerOpen = false;
    this.refreshView();
  }

  togglePasswordVisibility(field: 'current' | 'new' | 'confirm'): void {
    if (field === 'current') {
      this.showCurrentPassword = !this.showCurrentPassword;
      return;
    }

    if (field === 'new') {
      this.showNewPassword = !this.showNewPassword;
      return;
    }

    this.showConfirmPassword = !this.showConfirmPassword;
  }

  addVisitedCountry(countryValue: string): void {
    const country = countryValue.trim();

    if (!country || this.visitedCountries.includes(country)) {
      return;
    }

    this.visitedCountries = [...this.visitedCountries, country];
    this.saveVisitedCountries();
  }

  removeVisitedCountry(country: string): void {
    this.visitedCountries = this.visitedCountries.filter((visitedCountry) => visitedCountry !== country);
    this.saveVisitedCountries();
  }

  toggleTravelAchievement(key: string): void {
    this.selectedTravelAchievements = this.selectedTravelAchievements.includes(key)
      ? this.selectedTravelAchievements.filter((achievement) => achievement !== key)
      : [...this.selectedTravelAchievements, key];
  }

  isTravelAchievementSelected(key: string): boolean {
    return this.selectedTravelAchievements.includes(key);
  }

  friendDisplayName(user: FriendUserSummary): string {
    const firstName = user.firstName?.trim();
    const lastName = user.lastName?.trim();
    const fullName = [firstName, lastName].filter(Boolean).join(' ');

    return fullName || user.username;
  }

  friendInitials(user: FriendUserSummary): string {
    return this.friendDisplayName(user)
      .split(/[\s@._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'FR';
  }

  friendRelationshipLabel(status: FriendSearchResult['relationshipStatus']): string {
    switch (status) {
      case 'FRIEND':
        return 'Friends';
      case 'OUTGOING_PENDING':
        return 'Request sent';
      case 'INCOMING_PENDING':
        return 'Request received';
      default:
        return 'Add friend';
    }
  }

  sendFriendRequest(receiverId: number): void {
    this.friendCommunityError = '';
    this.friendCommunityService.sendFriendRequest({ receiverId })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.renderNow(() => this.loadFriendCommunity()),
        error: (error) => this.renderNow(() => {
          this.friendCommunityError = this.extractErrorMessage(error, 'Could not send the friend request.');
        })
      });
  }

  acceptFriendRequest(requestId: number): void {
    this.friendCommunityError = '';
    this.friendCommunityService.acceptFriendRequest(requestId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.renderNow(() => this.loadFriendCommunity()),
        error: (error) => this.renderNow(() => {
          this.friendCommunityError = this.extractErrorMessage(error, 'Could not accept the friend request.');
        })
      });
  }

  declineFriendRequest(requestId: number): void {
    this.friendCommunityError = '';
    this.friendCommunityService.declineFriendRequest(requestId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.renderNow(() => this.loadFriendCommunity()),
        error: (error) => this.renderNow(() => {
          this.friendCommunityError = this.extractErrorMessage(error, 'Could not decline the friend request.');
        })
      });
  }

  deleteFriend(friendId: number): void {
    this.friendCommunityError = '';
    this.friendCommunityService.deleteFriend(friendId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.renderNow(() => this.loadFriendCommunity()),
        error: (error) => this.renderNow(() => {
          this.friendCommunityError = this.extractErrorMessage(error, 'Could not delete this friend.');

        })
      });
  }

  private applyProfile(profile: UserProfile): void {
    this.profile = profile;
    this.profileState.setProfile(profile);

    const airport = this.airportOptions.find(profile.homeAirport);
    this.selectedHomeAirport = airport;

    this.profileForm.patchValue({
      username: profile.username || '',
      firstName: profile.firstName || '',
      lastName: profile.lastName || '',
      phoneNumber: profile.phoneNumber || '',
      homeAirport: airport ? this.airportOptions.formatAirport(airport) : profile.homeAirport || ''
    }, { emitEvent: false });
    this.selectedTravelAchievements = this.normalizeTravelAchievements(profile.travelAchievements ?? []);

    this.airportSuggestions = [];
    this.airportSearchMessage = '';
    this.loadVisitedCountries();
  }

  private loadFriendSearchResults(query: string): void {
    const normalizedQuery = query.trim();

    if (normalizedQuery.length < 2) {
      this.friendSearchResults = [];
      this.friendSearchError = '';
      this.isLoadingFriendSearch = false;
      this.refreshView();
      return;
    }

    this.isLoadingFriendSearch = true;
    this.friendSearchError = '';
    this.refreshView();

    this.friendCommunityService.searchUsers(normalizedQuery)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (results) => this.renderNow(() => {
          this.friendSearchResults = results;
          this.isLoadingFriendSearch = false;
        }),
        error: (error) => this.renderNow(() => {
          this.friendSearchError = this.extractErrorMessage(error, 'Could not search for travelers.');
          this.friendSearchResults = [];
          this.isLoadingFriendSearch = false;
        })
      });
  }

  private loadIncomingFriendRequests(): void {
    this.isLoadingIncomingFriendRequests = true;
    this.refreshView();

    this.friendCommunityService.listIncomingRequests()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (requests) => this.renderNow(() => {
          this.incomingFriendRequests = requests;
          this.friendNotificationService.syncIncomingRequests(requests);
          this.isLoadingIncomingFriendRequests = false;
        }),
        error: (error) => this.renderNow(() => {
          this.friendCommunityError = this.extractErrorMessage(error, 'Could not load incoming friend requests.');
          this.incomingFriendRequests = [];
          this.isLoadingIncomingFriendRequests = false;
        })
      });
  }

  private loadFriends(): void {
    this.isLoadingFriends = true;
    this.refreshView();

    this.friendCommunityService.listFriends()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (friends) => this.renderNow(() => {
          this.friends = friends;
          this.isLoadingFriends = false;
        }),
        error: (error) => this.renderNow(() => {
          this.friendCommunityError = this.extractErrorMessage(error, 'Could not load your friends list.');
          this.friends = [];
          this.isLoadingFriends = false;
        })
      });
  }

  private isUpcomingTrip(trip: TripResponse): boolean {
    if (trip.status === 'UPCOMING') {
      return true;
    }

    const startDate = new Date(`${trip.startDate}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return !Number.isNaN(startDate.getTime()) && startDate >= today;
  }

  private tripDestinationCandidates(trip: TripResponse): string[] {
    return [
      trip.destination,
      ...this.parseDestinationCities(trip.destinationCities),
      trip.hotelCity ?? '',
      trip.hotelDetails ?? '',
      trip.flightTitle ?? '',
      trip.activitiesDetails ?? ''
    ].flatMap((value) => this.splitDestinationText(value));
  }

  private parseDestinationCities(value: string | null | undefined): string[] {
    if (!value) {
      return [];
    }

    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is string => typeof item === 'string');
      }
    } catch {
      // Older drafts can store city text instead of JSON.
    }

    return this.splitDestinationText(value);
  }

  private splitDestinationText(value: string | null | undefined): string[] {
    if (!value) {
      return [];
    }

    return value
      .split(/[|,;·→/]+/)
      .map((part) => part.replace(/\([A-Z]{3}\)/g, ' ').trim())
      .filter((part) => this.normalizeLooseText(part).length > 1);
  }

  private setupAirportSearch(): void {
    this.profileForm.controls.homeAirport.valueChanges
      .pipe(
        debounceTime(180),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((value) => this.updateAirportSuggestions(value));
  }

  private setupFriendSearch(): void {
    this.friendSearchControl.valueChanges
      .pipe(
        debounceTime(220),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((value) => this.loadFriendSearchResults(value));
  }

  private focusFriendSearchFromFragment(fragment: string | null): void {
    if (fragment !== 'friend-search') {
      return;
    }

    setTimeout(() => {
      const input = document.getElementById('friend-search-input') as HTMLInputElement | null;
      input?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      input?.focus();
    });
  }

  private updateAirportSuggestions(value: string): void {
    const query = value.trim();
    const exactAirport = this.airportOptions.find(query);

    this.selectedHomeAirport = exactAirport && this.isExactAirportSelection(query, exactAirport)
      ? exactAirport
      : null;

    if (!query || this.selectedHomeAirport || /^[A-Za-z]{3}$/.test(query)) {
      this.clearHomeAirportError();
    }

    if (!this.isAirportPickerOpen) {
      return;
    }

    this.isAirportSearching = true;
    this.airportSuggestions = this.airportOptions.search(query);
    this.isAirportSearching = false;
    this.airportSearchMessage = query && this.airportSuggestions.length === 0
      ? 'No matching airports found.'
      : '';
  }

  private loadVisitedCountries(): void {
    try {
      const storedCountries = JSON.parse(localStorage.getItem(this.visitedCountriesStorageKey()) || '[]');
      this.visitedCountries = Array.isArray(storedCountries)
        ? this.uniqueValues(storedCountries.filter((country): country is string => typeof country === 'string' && country.trim().length > 1))
        : [];
    } catch {
      this.visitedCountries = [];
    }
  }

  private saveVisitedCountries(): void {
    localStorage.setItem(this.visitedCountriesStorageKey(), JSON.stringify(this.visitedCountries));
  }

  private visitedCountriesStorageKey(): string {
    const identity = this.profile?.email || this.authService.email() || 'anonymous';
    return `sep.profile.visitedCountries.${identity.toLowerCase()}`;
  }

  private resolveHomeAirportCodeForSave(): string | null {
    const rawValue = this.profileForm.controls.homeAirport.value.trim();

    if (!rawValue) {
      return '';
    }

    const foundAirport = this.airportOptions.find(rawValue);
    const selectedAirport = this.selectedHomeAirport && this.isExactAirportSelection(rawValue, this.selectedHomeAirport)
      ? this.selectedHomeAirport
      : null;
    const airport = foundAirport ?? selectedAirport;

    if (airport) {
      this.selectedHomeAirport = airport;
      this.profileForm.controls.homeAirport.setValue(this.airportOptions.formatAirport(airport), { emitEvent: false });
      return airport.code;
    }

    const codeFromText = this.extractAirportCode(rawValue);
    if (codeFromText) {
      return codeFromText;
    }

    return null;
  }

  private extractAirportCode(value: string): string | null {
    const parenthesizedCode = value.match(/\(([A-Za-z]{3})\)/)?.[1];
    const exactCode = value.match(/^[A-Za-z]{3}$/)?.[0];
    const trailingCode = value.match(/(?:^|[\s·,/-])([A-Za-z]{3})\s*$/)?.[1];
    const code = parenthesizedCode || exactCode || trailingCode || '';

    return code ? code.toUpperCase() : null;
  }

  private setHomeAirportError(): void {
    const control = this.profileForm.controls.homeAirport;
    control.setErrors({ ...(control.errors ?? {}), airport: true });
  }

  private clearHomeAirportError(): void {
    const control = this.profileForm.controls.homeAirport;

    if (!control.hasError('airport')) {
      return;
    }

    const remainingErrors = { ...(control.errors ?? {}) };
    delete remainingErrors['airport'];
    control.setErrors(Object.keys(remainingErrors).length ? remainingErrors : null);
  }

  private normalizeTravelAchievements(values: string[]): string[] {
    const allowed = new Set(this.travelAchievementOptions.map((option) => option.key));
    return values
      .map((value) => value.trim().toUpperCase())
      .filter((value) => allowed.has(value))
      .filter((value, index, array) => array.indexOf(value) === index);
  }

  private isExactAirportSelection(value: string, airport: AirportOption): boolean {
    const normalizedValue = this.normalizeAirportText(value);
    return normalizedValue === this.normalizeAirportText(airport.code)
      || normalizedValue === this.normalizeAirportText(airport.city)
      || normalizedValue === this.normalizeAirportText(airport.fullName)
      || normalizedValue === this.normalizeAirportText(this.airportOptions.formatAirport(airport));
  }

  private normalizeAirportText(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  private normalizeLooseText(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  private uniqueValues(values: string[]): string[] {
    return values
      .map((value) => value.trim())
      .filter(Boolean)
      .filter((value, index, array) => array.indexOf(value) === index);
  }

  private renderNow(update: () => void): void {
    this.zone.run(() => {
      update();
      this.refreshView();
    });
  }

  private refreshView(): void {
    this.cdr.detectChanges();
  }

  private passwordMatchValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const newPassword = control.get('newPassword')?.value;
      const confirmPassword = control.get('confirmPassword')?.value;

      if (!newPassword || !confirmPassword || newPassword === confirmPassword) {
        return null;
      }

      return { passwordMismatch: true };
    };
  }

  private extractErrorMessage(error: unknown, fallback: string): string {
    const httpError = error as HttpErrorResponse;
    const body = httpError.error;

    if (httpError.status === 0) {
      return 'Could not reach the backend. Make sure the backend is running.';
    }

    if (body && typeof body === 'object') {
      const messageBody = body as { message?: string; detail?: string; title?: string; error?: string };
      return messageBody.message || messageBody.detail || messageBody.error || messageBody.title || fallback;
    }

    if (typeof body === 'string' && body.trim()) {
      try {
        const parsed = JSON.parse(body) as { message?: string; detail?: string; title?: string; error?: string };
        return parsed.message || parsed.detail || parsed.error || parsed.title || body;
      } catch {
        // Some server/proxy errors are plain text, so keep them readable.
      }

      return body;
    }

    return fallback;
  }
}
