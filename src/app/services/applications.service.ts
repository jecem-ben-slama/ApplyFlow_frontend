import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { API_CONFIG } from '../config';
import {
  ApiResponse,
  Page,
  ApplicationCreateDto,
  ApplicationResponseDto,
} from '../models';

@Injectable({
  providedIn: 'root',
})
export class ApplicationsService {
  private readonly baseUrl = API_CONFIG.endpoints.applications.base;

  constructor(private http: HttpClient) {}

  /**
   * GET /api/applications
   * Retrieves a paginated slice of application history matching the user context.
   */
  getAllApplications(
    page: number = 0,
    size: number = 10,
    sortBy: string = 'dateApplied',
    direction: 'asc' | 'desc' = 'desc'
  ): Observable<Page<ApplicationResponseDto>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString())
      .set('sortBy', sortBy)
      .set('direction', direction);

    return this.http
      .get<ApiResponse<Page<ApplicationResponseDto>>>(this.baseUrl, {
        params,
        withCredentials: API_CONFIG.httpOptions.withCredentials,
      })
      .pipe(map((response) => response.data));
  }

  /**
   * GET /api/applications/{id}
   * Fetches the complete, compiled details of an individual application tracking record.
   */
  getApplicationById(id: number): Observable<ApplicationResponseDto> {
    return this.http
      .get<ApiResponse<ApplicationResponseDto>>(`${this.baseUrl}/${id}`, {
        withCredentials: API_CONFIG.httpOptions.withCredentials,
      })
      .pipe(map((response) => response.data));
  }

  /**
   * POST /api/applications
   * Commits a brand new job tracking entry and forces the template/email engine to compile.
   */
  createApplication(
    application: ApplicationCreateDto
  ): Observable<ApplicationResponseDto> {
    return this.http
      .post<ApiResponse<ApplicationResponseDto>>(this.baseUrl, application, {
        withCredentials: API_CONFIG.httpOptions.withCredentials,
      })
      .pipe(map((response) => response.data));
  }

  /**
   * PATCH /api/applications/{id}
   * Modifies a tracking record's inline lifecycle status parameters or text notes.
   */
  patchApplicationStatusOrNotes(
    id: number,
    status?: string,
    notes?: string
  ): Observable<ApplicationResponseDto> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    if (notes) params = params.set('notes', notes);

    // Using an empty body ({}) since modifications pass strictly via query parameters
    return this.http
      .patch<ApiResponse<ApplicationResponseDto>>(
        `${this.baseUrl}/${id}`,
        {},
        {
          params,
          withCredentials: API_CONFIG.httpOptions.withCredentials,
        }
      )
      .pipe(map((response) => response.data));
  }

  /**
   * DELETE /api/applications/{id}
   * Discards an unneeded tracking sequence history point entirely.
   */
  deleteApplication(id: number): Observable<void> {
    return this.http
      .delete<ApiResponse<void>>(`${this.baseUrl}/${id}`, {
        withCredentials: API_CONFIG.httpOptions.withCredentials,
      })
      .pipe(map(() => undefined));
  }
}
