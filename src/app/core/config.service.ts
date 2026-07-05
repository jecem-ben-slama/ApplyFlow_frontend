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
        // Check if apiUrl property exists (even if empty), not just if it's truthy
        if (loaded && 'apiUrl' in loaded) {
          this.config = loaded;
          console.log(
            '✅ Loaded runtime config:',
            this.config.apiUrl || '(empty - will use environment.ts)'
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
