import { Injectable } from '@angular/core';
import { ConfigService } from '../core/config.service';

@Injectable({ providedIn: 'root' })
export class ApiConfig {
  constructor(private configService: ConfigService) {}

  get baseUrl(): string {
    return this.configService.apiUrl;
  }

  get endpoints() {
    const base = this.baseUrl;
    return {
      auth: {
        login: `${base}/oauth2/authorization/google`,
        logout: `${base}/api/auth/logout`,
        me: `${base}/api/auth/me`,
        deleteAccount: `${base}/api/auth/account`,
        guest: `${base}/api/auth/guest`,
      },
      applications: {
        base: `${base}/api/applications`,
        detail: (id: number) => `${base}/api/applications/${id}`,
        metrics: `${base}/api/applications/metrics`,
      },
      applicationPresets: {
        base: `${base}/api/application-presets`,
        detail: (id: number) => `${base}/api/application-presets/${id}`,
      },
      emails: {
        send: `${base}/api/emails/send`,
      },
      skills: {
        base: `${base}/api/skills`,
        profile: `${base}/api/skills/profile`,
      },
      categories: {
        base: `${base}/api/categories`,
      },
      templates: {
        base: `${base}/api/templates`,
        detail: (id: number) => `${base}/api/templates/${id}`,
      },
      cvVariants: {
        base: `${base}/api/cv-variants`,
        upload: `${base}/api/cv-variants/upload`,
      },
      analytics: {
        base: `${base}/api/analytics`,
      },
      stats: {
        base: `${base}/api/stats`,
        summary: `${base}/api/stats/summary`,
      },
    };
  }

  get httpOptions() {
    return {
      withCredentials: true,
    };
  }
}
