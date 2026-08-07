import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse } from '../models';
import { ApiConfig } from '../config/api.config';
import { StatMetricDto } from '../models/statsmetric.model';


@Injectable({
  providedIn: 'root',
})
export class AnalyticsService {
  constructor(private http: HttpClient, private api: ApiConfig) {}

  private get baseUrl(): string {
    return this.api.endpoints.analytics.base;
  }

  /**
   * GET /api/analytics/cv-performance
   */
  getCvStats(): Observable<StatMetricDto[]> {
    return this.http
      .get<ApiResponse<StatMetricDto[]>>(
        `${this.baseUrl}/cv-performance`,
        this.api.httpOptions
      )
      .pipe(map((response) => response.data));
  }

  /**
   * GET /api/analytics/language-performance
   */
  getLanguageStats(): Observable<StatMetricDto[]> {
    return this.http
      .get<ApiResponse<StatMetricDto[]>>(
        `${this.baseUrl}/language-performance`,
        this.api.httpOptions
      )
      .pipe(map((response) => response.data));
  }

  /**
   * GET /api/analytics/job-performance
   */
  getJobStats(): Observable<StatMetricDto[]> {
    return this.http
      .get<ApiResponse<StatMetricDto[]>>(
        `${this.baseUrl}/job-performance`,
        this.api.httpOptions
      )
      .pipe(map((response) => response.data));
  }
}
