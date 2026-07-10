import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router'; // 1. Added Router import
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
  private readonly router = inject(Router); // 2. Injected Router

  private readonly currentUserSubject = new BehaviorSubject<User | null>(null);
  public readonly currentUser$ = this.currentUserSubject.asObservable();

  private readonly isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  public readonly isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  loginWithGoogle(): void {
    window.location.href = this.api.endpoints.auth.login;
  }

  checkSession(): Observable<boolean> {
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
        }),
        map((response) => !!response.success),
        catchError(() => {
          this.clearLocalState();
          return of(false);
        })
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
    this.router.navigate(['/login']); // 3. Single Page App routing path
  }

  private clearLocalState(): void {
    this.currentUserSubject.next(null);
    this.isAuthenticatedSubject.next(false);
  }

  private handleLogoutRedirect(): void {
    this.clearLocalState();
    this.router.navigate(['/login']); // 4. Single Page App routing path
  }
}
