import { ApplicationConfig, APP_INITIALIZER, inject } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ConfigService } from './core/config.service';
import { ApiConfig } from './config/api.config';
import { authInterceptor } from './services/auth.interceptor'; // adjust path to wherever you put it

export const appConfig: ApplicationConfig = {
  providers: [
    ConfigService,
    ApiConfig,
    {
      provide: APP_INITIALIZER,
      useFactory: () => {
        const configService = inject(ConfigService);
        return () => configService.loadConfig();
      },
      multi: true,
    },
    provideHttpClient(withInterceptors([authInterceptor])),
  ],
};
