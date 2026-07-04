import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiConfig } from '../config';

export interface EmailSendRequest {
  recipientEmail: string;
  subject: string;
  body: string;
  cvVariantId?: number;
}

@Injectable({
  providedIn: 'root',
})
export class EmailService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiConfig);

  /**
   * Dispatches the compiled form payload over to the Spring Boot pipeline
   */
  sendEmail(payload: EmailSendRequest): Observable<string> {
    return this.http.post(this.api.endpoints.emails.send, payload, {
      ...this.api.httpOptions,
      responseType: 'text',
    });
  }
}
