import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class LoadingService {
  private readonly loadingSubject = new BehaviorSubject<boolean>(false);
  private requestCount = 0;
  private loadingDelayTimer: ReturnType<typeof setTimeout> | null = null;

  readonly isLoading$ = this.loadingSubject.asObservable();

  start(): void {
    this.requestCount += 1;

    if (this.requestCount === 1 && !this.loadingSubject.value && !this.loadingDelayTimer) {
      this.loadingDelayTimer = setTimeout(() => {
        this.loadingDelayTimer = null;

        if (this.requestCount > 0) {
          this.loadingSubject.next(true);
        }
      }, 275);
    }
  }

  stop(): void {
    this.requestCount = Math.max(0, this.requestCount - 1);

    if (this.requestCount === 0) {
      this.clearLoadingDelayTimer();
      this.loadingSubject.next(false);
    }
  }

  private clearLoadingDelayTimer(): void {
    if (this.loadingDelayTimer) {
      clearTimeout(this.loadingDelayTimer);
      this.loadingDelayTimer = null;
    }
  }
}
