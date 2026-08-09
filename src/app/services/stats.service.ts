import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse } from '../models';
import { ApiConfig } from '../config/api.config';

export type ApplicationStatus =
  | 'COMPILED'
  | 'SENT'
  | 'VIEWED'
  | 'RESPONDED'
  | 'INTERVIEW_SCHEDULED'
  | 'INTERVIEWING'
  | 'OFFER'
  | 'REJECTED'
  | 'GHOSTED'
  | 'WITHDRAWN';

export interface FunnelStage {
  status: ApplicationStatus;
  count: number;
}

export interface StatsSummary {
  totalApplications: number;
  sentCount: number;
  responseRate: number; // 0-1
  avgResponseDays: number | null;
  activeCount: number;
  terminalCount: number;
  neverViewedCount: number;
  neverViewedRate: number; // 0-1
  interviewedCount: number;
  offerCount: number;
  interviewToOfferRate: number | null; // 0-1, null if no interviews yet
}

export interface RejectionStage {
  stage: 'BEFORE_INTERVIEW' | 'AFTER_INTERVIEW';
  count: number;
}

export interface TimelineEvent {
  id: number;
  applicationId: number;
  status: ApplicationStatus;
  note: string | null;
  occurredAt: string; // ISO
  companyName?: string;
  jobTitle?: string;
}

export interface DateRange {
  from?: string; // ISO datetime
  to?: string;
}

@Injectable({ providedIn: 'root' })
export class StatsService {
  constructor(private http: HttpClient, private api: ApiConfig) {}

  private get baseUrl(): string {
    return this.api.endpoints.stats.base;
  }

  private buildParams(range?: DateRange): HttpParams {
    let params = new HttpParams();
    if (range?.from) params = params.set('from', range.from);
    if (range?.to) params = params.set('to', range.to);
    return params;
  }

  getSummary(range?: DateRange): Observable<StatsSummary> {
    return this.http
      .get<ApiResponse<StatsSummary>>(`${this.baseUrl}/summary`, {
        ...this.api.httpOptions,
        params: this.buildParams(range),
      })
      .pipe(map((response) => response.data));
  }

  getFunnel(range?: DateRange): Observable<FunnelStage[]> {
    return this.http
      .get<ApiResponse<FunnelStage[]>>(`${this.baseUrl}/funnel`, {
        ...this.api.httpOptions,
        params: this.buildParams(range),
      })
      .pipe(map((response) => response.data));
  }

  getRejectionStages(range?: DateRange): Observable<RejectionStage[]> {
    return this.http
      .get<ApiResponse<RejectionStage[]>>(`${this.baseUrl}/rejection-stages`, {
        ...this.api.httpOptions,
        params: this.buildParams(range),
      })
      .pipe(map((response) => response.data));
  }

  getRecentEvents(limit: number = 8): Observable<TimelineEvent[]> {
    const params = new HttpParams().set('limit', limit.toString());
    return this.http
      .get<ApiResponse<TimelineEvent[]>>(`${this.baseUrl}/recent-events`, {
        ...this.api.httpOptions,
        params,
      })
      .pipe(map((response) => response.data));
  }

  getApplicationTimeline(applicationId: number): Observable<TimelineEvent[]> {
    return this.http
      .get<ApiResponse<TimelineEvent[]>>(
        `${this.baseUrl}/${applicationId}/timeline`,
        this.api.httpOptions
      )
      .pipe(map((response) => response.data));
  }
}
