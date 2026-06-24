import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_CONFIG } from '../config';

export interface EmailSendRequest {
  recipientEmail: string;
  subject: string;
  body: string;
  cvVariantId?: number; // Uses the variant ID identifier
}

@Injectable({
  providedIn: 'root',
})
export class EmailService {
  constructor(private http: HttpClient) {}

  /**
   * Dispatches the compiled form payload over to the Spring Boot pipeline
   */
  sendEmail(payload: EmailSendRequest): Observable<string> {
    return this.http.post(API_CONFIG.endpoints.emails.send, payload, {
      ...API_CONFIG.httpOptions,
      responseType: 'text',
    });
  }
}
