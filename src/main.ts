import { bootstrapApplication } from '@angular/platform-browser';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { APP_INITIALIZER } from '@angular/core';
import { AppComponent } from './app/app.component';
import { ConfigService } from './app/core/config.service';
import { routes } from './app/app-routing.module';
import { from } from 'rxjs'; // 1. Import 'from'
import { switchMap } from 'rxjs/operators';
import { AuthService } from './app/services/auth.service';

// 2. Wrap the Promise with from() so we can stream into checkSession()
export function initializeAppFactory(
  configService: ConfigService,
  authService: AuthService
) {
  return () =>
    from(configService.loadConfig()).pipe(
      switchMap(() => authService.checkSession())
    );
}

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes),
    provideHttpClient(),
    provideAnimations(),
    ConfigService,
    AuthService,
    {
      provide: APP_INITIALIZER,
      useFactory: initializeAppFactory,
      deps: [ConfigService, AuthService],
      multi: true,
    },
  ],
}).catch((err) => console.error('❌ Bootstrap error:', err));
