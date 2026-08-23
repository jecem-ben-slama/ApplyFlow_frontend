import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { ToastService } from '../components/common/toast/toast.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const toast = inject(ToastService);

  return next(req).pipe(
    catchError((err) => {
      switch (err?.status) {
        case 401:
          // Real session expiry — only case that should force a logout
          authService.handleUnauthorized();
          break;

        case 409:
          // Google access revoked/needs re-consent — app session stays valid.
          toast.error(
            err?.error?.message ??
              'Your Google access has expired. Please reconnect your Google account in Settings.',
            8000
          );
          break;

        case 429:
          // Throttling catch — displays warning toast if client pushes rate limits elsewhere
          toast.error(
            'Too many requests. Please slow down and try again in a few moments.',
            6000
          );
          break;

        case 503:
          // Transient Google/network error — just inform, don't touch auth state
          toast.error(
            err?.error?.message ??
              'Temporarily unavailable. Please try again shortly.',
            6000
          );
          break;
      }

      return throwError(() => err);
    })
  );
};
