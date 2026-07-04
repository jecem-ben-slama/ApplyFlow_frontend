import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {  ApiConfig } from '../config';
import { ApiResponse, Page, TemplateDto } from '../models';

@Injectable({
  providedIn: 'root',
})
export class TemplateService {
  private readonly baseUrl = this.api.endpoints.templates.base;

  constructor(private http: HttpClient, private api: ApiConfig) {}

  /**
   * GET /api/templates
   * Retrieves a paginated slice of templates owned by the authenticated user.
   * Extracts the underlying Page data block directly.
   */
  getAllTemplates(
    page: number = 0,
    size: number = 10,
    sortBy: string = 'id',
    direction: 'asc' | 'desc' = 'asc',
    language?: string,
    search?: string // ← new
  ): Observable<Page<TemplateDto>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString())
      .set('sortBy', sortBy)
      .set('direction', direction);

    if (language) params = params.set('language', language);
    if (search?.trim()) params = params.set('search', search.trim()); // ← new

    return this.http
      .get<ApiResponse<Page<TemplateDto>>>(this.baseUrl, {
        params,
        withCredentials: this.api.httpOptions.withCredentials,
      })
      .pipe(map((response) => response.data));
  }

  /**
   * GET /api/templates/{id}
   * Fetches a single template belonging strictly to the authenticated user.
   */
  getTemplateById(id: number): Observable<TemplateDto> {
    return this.http
      .get<ApiResponse<TemplateDto>>(`${this.baseUrl}/${id}`, {
        withCredentials: this.api.httpOptions.withCredentials,
      })
      .pipe(map((response) => response.data));
  }

  /**
   * POST /api/templates
   * Provisions a brand new user-owned template layout profile.
   */
  createTemplate(
    template: Omit<TemplateDto, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
  ): Observable<TemplateDto> {
    return this.http
      .post<ApiResponse<TemplateDto>>(this.baseUrl, template, {
        withCredentials: this.api.httpOptions.withCredentials,
      })
      .pipe(map((response) => response.data));
  }

  /**
   * PUT /api/templates/{id}
   * Updates an existing template configuration block matching the target path identifier.
   */
  updateTemplate(
    id: number,
    template: Omit<TemplateDto, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
  ): Observable<TemplateDto> {
    return this.http
      .put<ApiResponse<TemplateDto>>(`${this.baseUrl}/${id}`, template, {
        withCredentials: this.api.httpOptions.withCredentials,
      })
      .pipe(map((response) => response.data));
  }

  /**
   * DELETE /api/templates/{id}
   * Deletes a user's custom template from the system tracking pipeline.
   */
  deleteTemplate(id: number): Observable<void> {
    return this.http
      .delete<ApiResponse<any>>(`${this.baseUrl}/${id}`, {
        withCredentials: this.api.httpOptions.withCredentials,
      })
      .pipe(map(() => undefined));
  }
}
