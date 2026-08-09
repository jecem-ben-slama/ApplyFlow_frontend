import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse } from '../models';
import { ApiConfig } from '../config/api.config';
import { StatMetricDto } from '../models/statsmetric.model';
import { DateRange } from './stats.service';

export interface ApplicationSummaryDto {
  id: number;
  companyName: string | null;
  jobTitle: string | null;
  status: string | null;
}

export interface AnalyticsQuery extends DateRange {
  successStatuses?: string[];
}

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  constructor(private http: HttpClient, private api: ApiConfig) {}

  private get baseUrl(): string {
    return this.api.endpoints.analytics.base;
  }

  private buildParams(query?: AnalyticsQuery): HttpParams {
    let params = new HttpParams();
    if (query?.from) params = params.set('from', query.from);
    if (query?.to) params = params.set('to', query.to);
    if (query?.successStatuses?.length) {
      for (const status of query.successStatuses) {
        params = params.append('successStatuses', status);
      }
    }
    return params;
  }

  getCvStats(query?: AnalyticsQuery): Observable<StatMetricDto[]> {
    return this.http
      .get<ApiResponse<StatMetricDto[]>>(`${this.baseUrl}/cv-performance`, {
        ...this.api.httpOptions,
        params: this.buildParams(query),
      })
      .pipe(map((response) => response.data));
  }

  getLanguageStats(query?: AnalyticsQuery): Observable<StatMetricDto[]> {
    return this.http
      .get<ApiResponse<StatMetricDto[]>>(
        `${this.baseUrl}/language-performance`,
        {
          ...this.api.httpOptions,
          params: this.buildParams(query),
        }
      )
      .pipe(map((response) => response.data));
  }

  getJobStats(query?: AnalyticsQuery): Observable<StatMetricDto[]> {
    return this.http
      .get<ApiResponse<StatMetricDto[]>>(`${this.baseUrl}/job-performance`, {
        ...this.api.httpOptions,
        params: this.buildParams(query),
      })
      .pipe(map((response) => response.data));
  }

  getTemplateStats(query?: AnalyticsQuery): Observable<StatMetricDto[]> {
    return this.http
      .get<ApiResponse<StatMetricDto[]>>(
        `${this.baseUrl}/template-performance`,
        {
          ...this.api.httpOptions,
          params: this.buildParams(query),
        }
      )
      .pipe(map((response) => response.data));
  }

  listApplications(): Observable<ApplicationSummaryDto[]> {
    return this.http
      .get<ApiResponse<ApplicationSummaryDto[]>>(
        `${this.baseUrl}/applications`,
        this.api.httpOptions
      )
      .pipe(map((response) => response.data));
  }
}
