import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';
import { ApiResponse, Category } from '../models';
import { ApiConfig } from '../config/api.config';

@Injectable({
  providedIn: 'root',
})
export class CategoryService {
  private allCategories$?: Observable<Category[]>;

  constructor(private http: HttpClient, private api: ApiConfig) {}

  private get baseUrl(): string {
    return this.api.endpoints.categories.base;
  }
  /**
   * GET /api/categories
   * Returns all categories owned by the authenticated user.
   */
  getAllCategories(): Observable<Category[]> {
    if (this.allCategories$) return this.allCategories$;

    this.allCategories$ = this.http
      .get<ApiResponse<Category[]>>(this.baseUrl, this.api.httpOptions)
      .pipe(
        map((response) => response.data),
        shareReplay(1)
      );

    return this.allCategories$;
  }

  /**
   * GET /api/categories/{id}
   */
  getCategoryById(id: number): Observable<Category> {
    return this.http
      .get<ApiResponse<Category>>(`${this.baseUrl}/${id}`, this.api.httpOptions)
      .pipe(map((response) => response.data));
  }

  /**
   * POST /api/categories
   */
  createCategory(name: string): Observable<Category> {
    this.allCategories$ = undefined;
    return this.http
      .post<ApiResponse<Category>>(this.baseUrl, { name }, this.api.httpOptions)
      .pipe(map((response) => response.data));
  }

  /**
   * PUT /api/categories/{id}
   */
  updateCategory(id: number, name: string): Observable<Category> {
    this.allCategories$ = undefined;
    return this.http
      .put<ApiResponse<Category>>(
        `${this.baseUrl}/${id}`,
        { name },
        this.api.httpOptions
      )
      .pipe(map((response) => response.data));
  }

  /**
   * DELETE /api/categories/{id}
   * Will fail with 409 if skills are still assigned to this category.
   */
  deleteCategory(id: number): Observable<void> {
    this.allCategories$ = undefined;
    return this.http
      .delete<ApiResponse<void>>(`${this.baseUrl}/${id}`, this.api.httpOptions)
      .pipe(map(() => undefined));
  }
}
