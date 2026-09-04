import { ApplicationConfig, APP_INITIALIZER, inject } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router'; // Added standard router support
import { firstValueFrom } from 'rxjs';

import { ConfigService } from './core/config.service';
import { ApiConfig } from './config/api.config';
import { AuthService } from './services/auth.service';
import { routes } from './app-routing.module';
import { authInterceptor } from './interceptors/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    ConfigService,
    ApiConfig,
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),

    // 1. Initializer to load structural environment app settings first
    {
      provide: APP_INITIALIZER,
      useFactory: () => {
        const configService = inject(ConfigService);
        return () => configService.loadConfig();
      },
      multi: true,
    },

    // 2. Initializer to run the single backend auth handshake immediately after config maps load
    {
      provide: APP_INITIALIZER,
      useFactory: () => {
        const authService = inject(AuthService);
        // Angular executes all initializers sequentially if they return promises;
        // wrapping with firstValueFrom ensures this blocks until the network handshake resolves.
        return () => firstValueFrom(authService.checkSession());
      },
      multi: true,
    },
  ],
};
