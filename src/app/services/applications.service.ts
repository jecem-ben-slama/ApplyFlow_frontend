import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  ApiResponse,
  Page,
  ApplicationCreateDto,
  ApplicationResponseDto,
} from '../models';
import { ApiConfig } from '../config/api.config';

@Injectable({
  providedIn: 'root',
})
export class ApplicationsService {
  constructor(private http: HttpClient, private api: ApiConfig) {}

  private get baseUrl(): string {
    return this.api.endpoints.applications.base;
  }

  getAllApplications(
    page: number = 0,
    size: number = 10,
    sortBy: string = 'dateApplied',
    direction: 'asc' | 'desc' = 'desc',
    status?: string,
    keyword?: string
  ): Observable<Page<ApplicationResponseDto>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString())
      .set('sortBy', sortBy)
      .set('direction', direction);

    if (status) params = params.set('status', status);
    if (keyword) params = params.set('keyword', keyword);

    return this.http
      .get<ApiResponse<Page<ApplicationResponseDto>>>(this.baseUrl, {
        params,
        withCredentials: this.api.httpOptions.withCredentials,
      })
      .pipe(map((response) => response.data));
  }

  getApplicationById(id: number): Observable<ApplicationResponseDto> {
    return this.http
      .get<ApiResponse<ApplicationResponseDto>>(`${this.baseUrl}/${id}`, {
        withCredentials: this.api.httpOptions.withCredentials,
      })
      .pipe(map((response) => response.data));
  }

  createApplication(
    application: ApplicationCreateDto
  ): Observable<ApplicationResponseDto> {
    return this.http
      .post<ApiResponse<ApplicationResponseDto>>(this.baseUrl, application, {
        withCredentials: this.api.httpOptions.withCredentials,
      })
      .pipe(map((response) => response.data));
  }

  patchApplicationStatusOrNotes(
    id: number,
    status?: string,
    notes?: string
  ): Observable<ApplicationResponseDto> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    if (notes) params = params.set('notes', notes);

    return this.http
      .patch<ApiResponse<ApplicationResponseDto>>(
        `${this.baseUrl}/${id}`,
        {},
        {
          params,
          withCredentials: this.api.httpOptions.withCredentials,
        }
      )
      .pipe(map((response) => response.data));
  }

  deleteApplication(id: number): Observable<void> {
    return this.http
      .delete<ApiResponse<void>>(`${this.baseUrl}/${id}`, {
        withCredentials: this.api.httpOptions.withCredentials,
      })
      .pipe(map(() => undefined));
  }
}
