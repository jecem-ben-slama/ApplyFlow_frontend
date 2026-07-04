import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse, Page, CvVariantDto } from '../models';
import { ApiConfig } from '../config/api.config';

@Injectable({
  providedIn: 'root',
})
export class CvVariantsService {
  // Pulling the absolute URL directly to guarantee CORS cookies work perfectly
 constructor(private http: HttpClient, private api: ApiConfig) {}

  private get baseUrl(): string {
    return this.api.endpoints.cvVariants.base;
  }
  /**
   * GET /api/cv-variants
   * Retrieves a paginated slice of CV variants matching the current user context.
   */
  getAllCvVariants(
    page: number = 0,
    size: number = 10,
    sortBy: string = 'id',
    direction: 'asc' | 'desc' = 'asc',
    language?: string,
    search?: string
  ): Observable<Page<CvVariantDto>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString())
      .set('sortBy', sortBy)
      .set('direction', direction);

    if (language) {
      params = params.set('language', language);
    }

    if (search) {
      params = params.set('search', search);
    }

    return this.http
      .get<ApiResponse<Page<CvVariantDto>>>(this.baseUrl, {
        params,
        withCredentials: this.api.httpOptions.withCredentials,
      })
      .pipe(map((response) => response.data));
  }
  /**
   * GET /api/cv-variants/{id}
   * Fetches a single CV variant configuration block belonging strictly to the user.
   */
  getCvVariantById(id: number): Observable<CvVariantDto> {
    return this.http
      .get<ApiResponse<CvVariantDto>>(`${this.baseUrl}/${id}`, {
        withCredentials: this.api.httpOptions.withCredentials,
      })
      .pipe(map((response) => response.data));
  }

  /**
   * POST /api/cv-variants
   * Provisions a brand new custom CV tracking profile record.
   */
  createCvVariant(
    cvVariant: Omit<CvVariantDto, 'id' | 'userId' | 'createdAt'>
  ): Observable<CvVariantDto> {
    return this.http
      .post<ApiResponse<CvVariantDto>>(this.baseUrl, cvVariant, {
        withCredentials: this.api.httpOptions.withCredentials,
      })
      .pipe(map((response) => response.data));
  }

  /**
   * PUT /api/cv-variants/{id}
   * Updates metadata configurations for a specific targeted CV record.
   */
  updateCvVariant(
    id: number,
    cvVariant: Omit<CvVariantDto, 'id' | 'userId' | 'createdAt'>
  ): Observable<CvVariantDto> {
    return this.http
      .put<ApiResponse<CvVariantDto>>(`${this.baseUrl}/${id}`, cvVariant, {
        withCredentials: this.api.httpOptions.withCredentials,
      })
      .pipe(map((response) => response.data));
  }

  /**
   * DELETE /api/cv-variants/{id}
   * Completely removes a tracked CV path block from the workspace pipelines.
   */
  deleteCvVariant(id: number): Observable<void> {
    return this.http
      .delete<ApiResponse<void>>(`${this.baseUrl}/${id}`, {
        withCredentials: this.api.httpOptions.withCredentials,
      })
      .pipe(map(() => undefined));
  }
}
