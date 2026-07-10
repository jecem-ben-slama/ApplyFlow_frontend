import { bootstrapApplication } from '@angular/platform-browser';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { APP_INITIALIZER } from '@angular/core';
import { AppComponent } from './app/app.component';
import { ConfigService } from './app/core/config.service';
import { routes } from './app/app-routing.module';

export function initializeAppFactory(configService: ConfigService) {
  return () => configService.loadConfig();
}

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes),
    provideHttpClient(), // add withInterceptors(...) here once you share your interceptor
    provideAnimations(),
    ConfigService,
    {
      provide: APP_INITIALIZER,
      useFactory: initializeAppFactory,
      deps: [ConfigService],
      multi: true,
    },
  ],
}).catch((err) => console.error('❌ Bootstrap error:', err));
