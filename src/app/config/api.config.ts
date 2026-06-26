import { environment } from '../../environments/environment';

export const API_CONFIG = {
  /**
   * Root backend microservice location
   */
  baseUrl: environment.apiUrl,

  /**
   * Strongly-typed feature route endpoints mapping to Spring Boot Controllers
   */
  endpoints: {
    auth: {
      login: `${environment.apiUrl}/oauth2/authorization/google`,
      logout: `${environment.apiUrl}/logout`,
      me: `${environment.apiUrl}/api/auth/me`,
    },
    applications: {
      base: `${environment.apiUrl}/api/applications`,
      detail: (id: number) => `${environment.apiUrl}/api/applications/${id}`,
      metrics: `${environment.apiUrl}/api/applications/metrics`,
    },
    emails: {
      send: `${environment.apiUrl}/api/emails/send`, // New endpoint for processing dynamic emails
    },
    skills: {
      base: `${environment.apiUrl}/api/skills`,
      profile: `${environment.apiUrl}/api/skills/profile`,
    },
    categories: {
  base: `${environment.apiUrl}/api/categories`,
},
    templates: {
      base: `${environment.apiUrl}/api/templates`,
      detail: (id: number) => `${environment.apiUrl}/api/templates/${id}`,
    },
    cvVariants: {
      base: `${environment.apiUrl}/api/cv-variants`,
      upload: `${environment.apiUrl}/api/cv-variants/upload`,
    },
  },

  /**
   * Default configuration options for HttpClient requests
   */
  httpOptions: {
    // Required to automatically attach Session cookies from Spring Security OAuth2
    withCredentials: true,
  },
};
