import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { filter, map, switchMap, take } from 'rxjs/operators';
import { AuthService } from 'src/app/services/auth.service';
export const guestGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // 1. If we already completed the initial check and know the user is authenticated, block instantly
  if (authService.isAuthenticated) {
    router.navigate(['/applications']);
    return false;
  }

  // 2. Otherwise, wait until the application is finished checking the session with the backend
  return authService.isCheckingSession$.pipe(
    filter((isChecking) => !isChecking), // Block until checking is completely FALSE
    take(1),
    switchMap(() => authService.isAuthenticated$), // Switch to check the final auth value
    take(1),
    map((isAuthenticated) => {
      if (isAuthenticated) {
        // User is logged in, redirect them away from login!
        router.navigate(['/applications']);
        return false;
      }
      // User is truly an unauthenticated guest, allow access to /login
      return true;
    })
  );
};