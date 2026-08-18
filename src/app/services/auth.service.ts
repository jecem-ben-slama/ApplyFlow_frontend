import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, of, BehaviorSubject } from 'rxjs';
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

  loginWithGoogle(): void {
    window.location.href = this.api.endpoints.auth.login;
  }

  checkSession(): Observable<boolean> {
    this.isCheckingSessionSubject.next(true);

    return this.http
      .get<ApiResponse<User>>(this.api.endpoints.auth.me, this.api.httpOptions)
      .pipe(
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
        catchError(() => {
          this.clearLocalState();
          this.isCheckingSessionSubject.next(false);
          return of(false);
        })
      );
  }
  deleteAccount(): Observable<boolean> {
    return this.http
      .delete<ApiResponse<void>>(
        this.api.endpoints.auth.deleteAccount,
        this.api.httpOptions
      )
      .pipe(
        tap(() => {
          // Backend already killed the session server-side, same as logout.
          // Reuse the exact same cross-tab broadcast so every open tab redirects.
          this.clearLocalState();
          localStorage.setItem(this.LOGOUT_EVENT_KEY, Date.now().toString());
        }),
        map((response) => !!response.success)
        // No catchError here — let the component see the raw error (e.g. 409
        // if deletion was already requested) and surface response.error.message.
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
