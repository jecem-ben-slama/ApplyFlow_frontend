import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import {
  Observable,
  tap,
  catchError,
  of,
  BehaviorSubject,
  retry,
  timer,
} from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';
import { ApiConfig } from '../config/api.config';
import { ApiResponse, User } from '../models';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiConfig);
  private readonly router = inject(Router);

  private readonly currentUserSubject = new BehaviorSubject<User | null>(null);
  public readonly currentUser$ = this.currentUserSubject.asObservable();

  private readonly isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  public readonly isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  private readonly isCheckingSessionSubject = new BehaviorSubject<boolean>(
    true
  );
  public readonly isCheckingSession$ =
    this.isCheckingSessionSubject.asObservable();

  private readonly needsGoogleReconnectSubject = new BehaviorSubject<boolean>(
    false
  );
  public readonly needsGoogleReconnect$ =
    this.needsGoogleReconnectSubject.asObservable();

  private readonly LOGOUT_EVENT_KEY = 'applyflow_logout_event';
  private checkSession$?: Observable<boolean>;

  constructor() {
    window.addEventListener('storage', (event) => {
      if (event.key === this.LOGOUT_EVENT_KEY) {
        this.handleCrossTabLogout();
      }
    });
  }

  public get isAuthenticated(): boolean {
    return this.isAuthenticatedSubject.value;
  }

  loginWithGoogle(): void {
    window.location.href = this.api.endpoints.auth.login;
  }

  checkSession(): Observable<boolean> {
    if (this.checkSession$) {
      return this.checkSession$;
    }

    this.isCheckingSessionSubject.next(true);

    this.checkSession$ = this.http
      .get<ApiResponse<User>>(this.api.endpoints.auth.me, this.api.httpOptions)
      .pipe(
        retry({
          count: 2,
          delay: (error, retryCount) => {
            if (error?.status === 401 || error?.status === 429) {
              throw error;
            }
            return timer(1500 * retryCount);
          },
        }),
        tap((response) => {
          if (response.success && response.data) {
            this.currentUserSubject.next(response.data);
            this.isAuthenticatedSubject.next(true);
          } else {
            this.clearLocalState();
          }
          this.isCheckingSessionSubject.next(false);
        }),
        map((response) => !!response.success),
        catchError((err) => {
          this.isCheckingSessionSubject.next(false);

          if (err?.status === 401) {
            this.clearLocalState();
          } else if (err?.status === 429) {
            console.warn(
              'checkSession hit rate limit (429), preserving existing state.'
            );
          } else {
            console.warn(
              'checkSession failed after retries with non-401/429 status, preserving auth state:',
              err?.status
            );
          }

          return of(false);
        }),
        shareReplay(1),
        tap({
          complete: () => {
            this.checkSession$ = undefined;
          },
          error: () => {
            this.checkSession$ = undefined;
          },
        })
      );

    return this.checkSession$;
  }

  deleteAccount(confirmationPhrase: string): Observable<boolean> {
    return this.http
      .delete<ApiResponse<void>>(this.api.endpoints.auth.deleteAccount, {
        ...this.api.httpOptions,
        body: { confirmationPhrase },
      })
      .pipe(
        tap(() => {
          this.clearLocalState();
          localStorage.setItem(this.LOGOUT_EVENT_KEY, Date.now().toString());
        }),
        map((response) => !!response.success)
      );
  }

  logout(): void {
    this.http
      .post(this.api.endpoints.auth.logout, {}, this.api.httpOptions)
      .subscribe({
        next: () => this.handleLogoutRedirect(),
        error: () => this.handleLogoutRedirect(),
      });
  }

  handleUnauthorized(): void {
    this.clearLocalState();
    localStorage.setItem(this.LOGOUT_EVENT_KEY, Date.now().toString());
    this.router.navigate(['/login']);
  }

  reconnectGoogle(): void {
    this.needsGoogleReconnectSubject.next(false);
    window.location.href = this.api.endpoints.auth.login;
  }

  handleCrossTabLogout(): void {
    this.clearLocalState();
    this.router.navigate(['/login']).then(() => {
      window.location.reload();
    });
  }

  private clearLocalState(): void {
    this.currentUserSubject.next(null);
    this.isAuthenticatedSubject.next(false);
  }

  private handleLogoutRedirect(): void {
    this.clearLocalState();
    localStorage.setItem(this.LOGOUT_EVENT_KEY, Date.now().toString());
    this.router.navigate(['/login']).then(() => {
      window.location.reload();
    });
  }
}
