import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_CONFIG } from '../config';

export interface EmailSendRequest {
  userId: number;
  recipientEmail: string;
  subject: string;
  body: string;
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
      responseType: 'text', // Since the backend returns a raw text confirmation message
    });
  }
}
