// src/app/config/api.config.ts
import { Injectable } from '@angular/core';
import { ConfigService } from '../core/config.service';

@Injectable({ providedIn: 'root' })
export class ApiConfig {
  constructor(private configService: ConfigService) {}

  /**
   * Root backend microservice location
   */
  get baseUrl(): string {
    return this.configService.apiUrl;
  }

  /**
   * Strongly-typed feature route endpoints mapping to Spring Boot Controllers
   */
  get endpoints() {
    const base = this.baseUrl;
    return {
      auth: {
        login: `${base}/oauth2/authorization/google`,
        logout: `${base}/api/auth/logout`,
        me: `${base}/api/auth/me`,
      },
      applications: {
        base: `${base}/api/applications`,
        detail: (id: number) => `${base}/api/applications/${id}`,
        metrics: `${base}/api/applications/metrics`,
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
    };
  }

  /**
   * Default configuration options for HttpClient requests
   */
  get httpOptions() {
    return {
      withCredentials: true,
    };
  }
}
