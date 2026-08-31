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
import { map } from 'rxjs/operators';
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

  // Flag components (e.g. a settings banner) can watch to prompt reconnect
  private readonly needsGoogleReconnectSubject = new BehaviorSubject<boolean>(
    false
  );
  public readonly needsGoogleReconnect$ =
    this.needsGoogleReconnectSubject.asObservable();

  // True whenever the current session belongs to a guest (not yet linked
  // to a Google account). Components use this to show upgrade prompts.
  private readonly isGuestSubject = new BehaviorSubject<boolean>(false);
  public readonly isGuest$ = this.isGuestSubject.asObservable();

  // ─── LOGOUT BROADCAST KEY ───
  private readonly LOGOUT_EVENT_KEY = 'applyflow_logout_event';

  constructor() {
    // ─── LISTEN FOR LOGOUT ACTIONS FROM OTHER TABS ───
    window.addEventListener('storage', (event) => {
      if (event.key === this.LOGOUT_EVENT_KEY) {
        this.handleCrossTabLogout();
      }
    });
  }

  public get isAuthenticated(): boolean {
    return this.isAuthenticatedSubject.value;
  }

  public get isGuest(): boolean {
    return this.isGuestSubject.value;
  }

  loginWithGoogle(): void {
    // Full top-level navigation — required for the OAuth redirect round
    // trip and for the session cookie to survive it. Never call this via
    // HttpClient/fetch.
    window.location.href = this.api.endpoints.auth.login;
  }

  /**
   * Starts an anonymous guest session. Establishes a real session cookie,
   * identical in kind to a Google login — every other authenticated
   * endpoint works transparently afterward.
   */
  continueAsGuest(): Observable<boolean> {
    return this.http
      .post<ApiResponse<User>>(
        this.api.endpoints.auth.guest,
        {},
        this.api.httpOptions
      )
      .pipe(
        tap((response) => {
          if (response.success && response.data) {
            this.currentUserSubject.next(response.data);
            this.isAuthenticatedSubject.next(true);
            this.isGuestSubject.next(response.data.isGuest);
          }
        }),
        map((response) => !!response.success),
        catchError((err) => {
          console.error('Failed to start guest session:', err);
          return of(false);
        })
      );
  }

  /**
   * Checks whether the SESSION cookie is still valid server-side.
   * Retries transient failures (network blips, cold starts, 5xx) up to twice
   * before giving up — but never retries a genuine 401, and never clears
   * local auth state for anything other than a confirmed 401.
   */
  checkSession(): Observable<boolean> {
    this.isCheckingSessionSubject.next(true);

    return this.http
      .get<ApiResponse<User>>(this.api.endpoints.auth.me, this.api.httpOptions)
      .pipe(
        retry({
          count: 2,
          delay: (error, retryCount) => {
            if (error?.status === 401) {
              throw error; // don't retry a real "not logged in"
            }
            return timer(1500 * retryCount); // 1.5s, then 3s
          },
        }),
        tap((response) => {
          if (response.success && response.data) {
            this.currentUserSubject.next(response.data);
            this.isAuthenticatedSubject.next(true);
            this.isGuestSubject.next(response.data.isGuest);
          } else {
            this.clearLocalState();
          }
          this.isCheckingSessionSubject.next(false);
        }),
        map((response) => !!response.success),
        catchError((err) => {
          this.isCheckingSessionSubject.next(false);

          if (err?.status === 401) {
            // Session is genuinely dead — this is a real logout
            this.clearLocalState();
          } else {
            // Network blip, cold start, 503, CORS hiccup, etc.
            // Don't assert logged-out state on a transient failure.
            console.warn(
              'checkSession failed after retries with non-401 status, preserving auth state:',
              err?.status
            );
          }

          return of(false);
        })
      );
  }

  /**
   * Schedules the current account for deletion. `confirmationPhrase` is
   * whatever the user typed (e.g. "delete jane@example.com") — sent as-is;
   * the backend independently verifies it matches the account's real email
   * before doing anything.
   */
  deleteAccount(confirmationPhrase: string): Observable<boolean> {
    return this.http
      .delete<ApiResponse<void>>(this.api.endpoints.auth.deleteAccount, {
        ...this.api.httpOptions,
        body: { confirmationPhrase },
      })
      .pipe(
        tap(() => {
          // Backend already killed the session server-side, same as logout.
          // Reuse the exact same cross-tab broadcast so every open tab redirects.
          this.clearLocalState();
          localStorage.setItem(this.LOGOUT_EVENT_KEY, Date.now().toString());
        }),
        map((response) => !!response.success)
        // No catchError here — let the component see the raw error (e.g. 400
        // if the confirmation phrase didn't match) and surface response.error.message.
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

  /** Called by the interceptor when any API call returns a genuine 401 mid-session */
  handleUnauthorized(): void {
    this.clearLocalState();
    localStorage.setItem(this.LOGOUT_EVENT_KEY, Date.now().toString());
    this.router.navigate(['/login']);
  }

  /** Google-specific re-consent — does NOT touch app session state */
  reconnectGoogle(): void {
    this.needsGoogleReconnectSubject.next(false);
    window.location.href = this.api.endpoints.auth.login;
  }

  handleCrossTabLogout(): void {
    this.clearLocalState();
    this.router.navigate(['/login']).then(() => {
      // Force a UI refresh to drop existing routing state/DOM trees entirely
      window.location.reload();
    });
  }

  private clearLocalState(): void {
    this.currentUserSubject.next(null);
    this.isAuthenticatedSubject.next(false);
    this.isGuestSubject.next(false);
  }

  private handleLogoutRedirect(): void {
    this.clearLocalState();

    // ─── SIGNAL ALL OTHER OPEN TABS TO LOG OUT ───
    localStorage.setItem(this.LOGOUT_EVENT_KEY, Date.now().toString());

    this.router.navigate(['/login']).then(() => {
      window.location.reload();
    });
  }
}
