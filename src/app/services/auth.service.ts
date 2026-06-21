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

  /**
   * Triggers a raw browser redirect to the Spring Boot Google OAuth2 login pipeline.
   */
  loginWithGoogle(): void {
    window.location.href = API_CONFIG.endpoints.auth.login;
  }

  /**
   * Verifies the browser's active JSESSIONID cookie against the backend context.
   * Updates state subjects reactively based on validation status.
   */
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
   * Ends the authenticated session via Spring Security's state clearout endpoint.
   */
  logout(): void {
    this.http
      .post(API_CONFIG.endpoints.auth.logout, {}, API_CONFIG.httpOptions)
      .subscribe({
        next: () => this.handleLogoutRedirect(),
        error: () => this.handleLogoutRedirect(), // Fallback clean if session already dropped
      });
  }

  /**
   * Internal helper to flush application streams completely.
   */
  private clearLocalState(): void {
    this.currentUserSubject.next(null);
    this.isAuthenticatedSubject.next(false);
  }

  /**
   * Flushes local session data tracking state and drops user back to the application threshold.
   */
  private handleLogoutRedirect(): void {
    this.clearLocalState();
    window.location.href = '/login';
  }
}
