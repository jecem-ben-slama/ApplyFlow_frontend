import { ApplicationConfig, APP_INITIALIZER, inject } from '@angular/core';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { ConfigService } from './core/config.service';
import { ApiConfig } from './config/api.config';
import { AuthService } from './services/auth.service';

export const appConfig: ApplicationConfig = {
  providers: [
    ConfigService,
    ApiConfig,
    AuthService,
    {
      provide: APP_INITIALIZER,
      useFactory: () => {
        const configService = inject(ConfigService);
        return () => configService.loadConfig();
      },
      multi: true,
    },
    {
      provide: APP_INITIALIZER,
      useFactory: () => {
        const authService = inject(AuthService);
        return () =>
          authService
            .checkSession()
            .toPromise()
            .catch(() => null);
      },
      multi: true,
    },
    provideHttpClient(withInterceptorsFromDi()), // see note below
  ],
};
