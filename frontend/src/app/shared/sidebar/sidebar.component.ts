import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { AuthService } from '../../services/auth';
import { ProfileStateService } from '../../services/profile-state.service';

export interface NavItem {
  label: string;
  icon: SafeHtml;
  route?: string;
  active?: boolean;
  dividerBefore?: boolean;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarComponent {
  private readonly authService = inject(AuthService);
  private readonly profileState = inject(ProfileStateService);
  private readonly router = inject(Router);
  private readonly sanitizer = inject(DomSanitizer);

  @Input() isMobile = false;
  @Input() isOpen = true;
  @Output() closed = new EventEmitter<void>();

  readonly isAuthenticated = computed(() => this.authService.isAuthenticated());

  private trustSvg(svg: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(svg);
  }

  navItems = signal<NavItem[]>([
    {
      label: 'Dashboard',
      route: '/dashboard',
      active: true,
      icon: this.trustSvg(`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>`),
    },
    {
      label: 'Trips',
      route: '/trips',
      icon: this.trustSvg(`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M3 19h18"/><path d="M5 19V7l6-3 6 3v12"/><path d="M9 19v-6h6v6"/></svg>`),
    },
    {
      label: 'Flights',
      route: '/flights',
      icon: this.trustSvg(`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M10.5 21 9 15l-5-2 1.5-1.5L9 12l2.5-4 2 2.5L21 7l-4 6.5 2 2-3 1-3.5-2.5L10.5 21Z"/></svg>`),
    },
    {
      label: 'Hotels',
      route: '/hotels',
      icon: this.trustSvg(`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M4 21V7l8-4 8 4v14"/><path d="M9 21v-6h6v6"/><path d="M4 11h16"/></svg>`),
    },
    {
      label: 'Activities',
      route: '/activities',
      icon: this.trustSvg(`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M12 2 9 8l-6 1 4.5 4.3L6.5 20 12 17l5.5 3-1-6.7L21 9l-6-1-3-6Z"/></svg>`),
    },
    {
      label: 'Budget Tracker',
      route: '/budget-tracker',
      dividerBefore: true,
      icon: this.trustSvg(`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><rect x="2" y="4" width="20" height="16" rx="3"/><path d="M2 10h20"/><path d="M14 15h4"/><path d="M15.5 7.5h.01"/></svg>`),
    },
    {
      label: 'Calendar',
      route: '/calendar',
      icon: this.trustSvg(`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><rect x="3" y="4" width="18" height="17" rx="3"/><path d="M8 2v4"/><path d="M16 2v4"/><path d="M3 9h18"/></svg>`),
    },
    {
      label: 'Profile',
      route: '/profile',
      dividerBefore: true,
      icon: this.trustSvg(`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><circle cx="12" cy="8" r="4"/><path d="M4 20a8 8 0 0 1 16 0"/></svg>`),
    },
    {
      label: 'Settings',
      route: '/settings',
      icon: this.trustSvg(`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.86l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.34 1.86v.08a2 2 0 1 1-4 0v-.08A1.7 1.7 0 0 0 9.6 20a1.7 1.7 0 0 0-1-.6 1.7 1.7 0 0 0-1.86.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.86-.34H2a2 2 0 1 1 0-4h.08A1.7 1.7 0 0 0 4 9.6a1.7 1.7 0 0 0 .6-1 1.7 1.7 0 0 0-.34-1.86l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .34-1.86V2a2 2 0 1 1 4 0v.08A1.7 1.7 0 0 0 15 4a1.7 1.7 0 0 0 1 .6 1.7 1.7 0 0 0 1.86-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.38.28.56.82.6 1.2h.08a2 2 0 1 1 0 4h-.08c-.04.38-.22.92-.6 1.2Z"/></svg>`),
    },
  ]);

  setActive(label: string): void {
    this.navItems.update(items =>
      items.map(item => ({ ...item, active: item.label === label }))
    );

    if (this.isMobile) {
      this.closed.emit();
    }
  }

  requestClose(): void {
    this.closed.emit();
  }

  logout(): void {
    this.profileState.clear();
    this.authService.logout();

    if (this.isMobile) {
      this.closed.emit();
    }

    void this.router.navigate(['/login']);
  }
}
