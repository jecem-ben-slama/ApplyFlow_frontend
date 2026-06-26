import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, of, BehaviorSubject } from 'rxjs';
import { map } from 'rxjs/operators';
import { API_CONFIG } from '../config';
import { ApiResponse, User } from '../models';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);

  private readonly currentUserSubject = new BehaviorSubject<User | null>(null);
  public readonly currentUser$ = this.currentUserSubject.asObservable();

  private readonly isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  public readonly isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  loginWithGoogle(): void {
    window.location.href = API_CONFIG.endpoints.auth.login;
  }

  checkSession(): Observable<boolean> {
    return this.http
      .get<ApiResponse<User>>(
        API_CONFIG.endpoints.auth.me,
        API_CONFIG.httpOptions
      )
      .pipe(
        tap((response) => {
          if (response.success && response.data) {
            this.currentUserSubject.next(response.data);
            this.isAuthenticatedSubject.next(true);
          } else {
            this.clearLocalState();
          }
        }),
        map((response) => !!response.success),
        catchError(() => {
          this.clearLocalState();
          return of(false);
        })
      );
  }

  /**
   * Ends the session with the backend and redirects this tab to /login.
   * Called by the confirming tab only — other tabs use handleCrossTabLogout().
   */
  logout(): void {
    this.http
      .post(API_CONFIG.endpoints.auth.logout, {}, API_CONFIG.httpOptions)
      .subscribe({
        next: () => this.handleLogoutRedirect(),
        error: () => this.handleLogoutRedirect(),
      });
  }

  /**
   * Called on tabs that received the BroadcastChannel logout event.
   * Skips the backend call (the initiating tab already invalidated the session)
   * and goes straight to clearing state and redirecting.
   */
  handleCrossTabLogout(): void {
    this.clearLocalState();
    window.location.href = '/login';
  }

  private clearLocalState(): void {
    this.currentUserSubject.next(null);
    this.isAuthenticatedSubject.next(false);
  }

  private handleLogoutRedirect(): void {
    this.clearLocalState();
    window.location.href = '/login';
  }
}
