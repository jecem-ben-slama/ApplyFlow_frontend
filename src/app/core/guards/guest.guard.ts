import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, take } from 'rxjs/operators';
import { AuthService } from 'src/app/services/auth.service';

export const guestGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.isAuthenticated$.pipe(
    take(1),
    map((isAuthenticated) => {
      if (isAuthenticated) {
        // User is already logged in, send them away from the login page!
        router.navigate(['/skills']);
        return false;
      }
      // User is an anonymous guest, allow them to view the login component
      return true;
    })
  );
};
