import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';
import { ApiResponse, Page, Skill } from '../models';
import { ApiConfig } from '../config/api.config';

@Injectable({
  providedIn: 'root',
})
export class SkillsService {
  private readonly listCache = new Map<string, Observable<Page<Skill>>>();

  constructor(private http: HttpClient, private api: ApiConfig) {}

  private get baseUrl(): string {
    return this.api.endpoints.skills.base;
  }

  getAllSkills(
    page: number = 0,
    size: number = 10,
    sortBy: string = 'id',
    direction: 'asc' | 'desc' = 'asc',
    categoryId?: number | null,
    search?: string
  ): Observable<Page<Skill>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString())
      .set('sortBy', sortBy)
      .set('direction', direction);

    if (categoryId != null)
      params = params.set('categoryId', categoryId.toString());
    if (search?.trim()) params = params.set('search', search.trim());

    const cacheKey = params.toString();
    const cached = this.listCache.get(cacheKey);
    if (cached) return cached;

    const request$ = this.http
      .get<ApiResponse<Page<Skill>>>(this.baseUrl, {
        ...this.api.httpOptions,
        params,
      })
      .pipe(
        map((response) => response.data),
        shareReplay(1)
      );

    this.listCache.set(cacheKey, request$);
    return request$;
  }

  getSkillById(id: number): Observable<Skill> {
    return this.http
      .get<ApiResponse<Skill>>(`${this.baseUrl}/${id}`, this.api.httpOptions)
      .pipe(map((response) => response.data));
  }

  createSkill(
    skill: Omit<Skill, 'id' | 'userId' | 'categoryName'>
  ): Observable<Skill> {
    this.listCache.clear();
    return this.http
      .post<ApiResponse<Skill>>(this.baseUrl, skill, this.api.httpOptions)
      .pipe(map((response) => response.data));
  }

  updateSkill(
    id: number,
    skill: Omit<Skill, 'id' | 'userId' | 'categoryName'>
  ): Observable<Skill> {
    this.listCache.clear();
    return this.http
      .put<ApiResponse<Skill>>(
        `${this.baseUrl}/${id}`,
        skill,
        this.api.httpOptions
      )
      .pipe(map((response) => response.data));
  }

  deleteSkill(id: number): Observable<void> {
    this.listCache.clear();
    return this.http
      .delete<ApiResponse<void>>(`${this.baseUrl}/${id}`, this.api.httpOptions)
      .pipe(map(() => undefined));
  }
}
