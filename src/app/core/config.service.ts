import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

export interface AppConfig {
  apiUrl: string;
}

@Injectable({ providedIn: 'root' })
export class ConfigService {
  private config: AppConfig = {
    apiUrl: environment.apiUrl,
  };

  async loadConfig(): Promise<void> {
    try {
      const response = await fetch('/assets/config.json', {
        cache: 'no-cache',
      });

      if (response.ok) {
        const loaded = await response.json();

        if (loaded && 'apiUrl' in loaded) {
          this.config = {
            apiUrl: loaded.apiUrl ? loaded.apiUrl : environment.apiUrl,
          };

          console.log(
            '✅ Loaded runtime config:',
            this.config.apiUrl === environment.apiUrl
              ? '(empty - using environment.ts)'
              : this.config.apiUrl
          );
        }
      }
    } catch {
      console.warn(
        '⚠️ No runtime config.json found, falling back to environment.ts apiUrl'
      );
    }

    // Wake up the Render backend in the background.
    this.wakeUpBackend();
  }

  get apiUrl(): string {
    return this.config.apiUrl;
  }

  private wakeUpBackend(): void {
    const healthUrl = `${this.config.apiUrl}/actuator/health`;

    console.log('🔥 Waking up backend:', healthUrl);

    fetch(healthUrl, {
      method: 'GET',
      credentials: 'include',
    })
      .then(async (response) => {
        if (response.ok) {
          console.log('✅ Backend is awake');

          try {
            const health = await response.json();
            console.log('Backend health:', health);
          } catch {
            // Health endpoint responded but didn't return JSON.
          }
        } else {
          console.warn(
            `⚠️ Backend health check returned HTTP ${response.status}`
          );
        }
      })
      .catch((error) => {
        console.warn('⚠️ Backend wake-up request failed:', error);
      });
  }
}
