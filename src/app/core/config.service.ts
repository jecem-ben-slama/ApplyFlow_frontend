import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

export interface AppConfig {
  apiUrl: string;
}

@Injectable({ providedIn: 'root' })
export class ConfigService {
  private config: AppConfig = { apiUrl: environment.apiUrl };

  async loadConfig(): Promise<void> {
    try {
      const response = await fetch('/assets/config.json', {
        cache: 'no-cache',
      });
      if (response.ok) {
        const loaded = await response.json();

        if (loaded && 'apiUrl' in loaded) {
          // If loaded.apiUrl is empty or missing, fallback to environment.apiUrl
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
        'No runtime config.json found, falling back to environment.ts apiUrl'
      );
    }
  }
  get apiUrl(): string {
    return this.config.apiUrl;
  }
}
