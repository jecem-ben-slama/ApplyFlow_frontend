import { bootstrapApplication } from '@angular/platform-browser';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app/app.component';
import { ConfigService } from './app/core/config.service';
import { routes } from './app/app-routing.module';

async function initializeApp() {
  const configService = new ConfigService();
  console.log(' Initializing: Loading config...');
  await configService.loadConfig();
  console.log(' Config loaded. API URL:', configService.apiUrl);

  return bootstrapApplication(AppComponent, {
    providers: [
      provideRouter(routes),
      provideHttpClient(),
      provideAnimations(),
    ],
  });
}

initializeApp().catch((err) => console.error('❌ Bootstrap error:', err));
