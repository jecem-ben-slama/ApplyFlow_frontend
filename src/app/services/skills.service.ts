import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { API_CONFIG } from '../config';
import { ApiResponse, Page, Skill } from '../models';

@Injectable({
  providedIn: 'root',
})
export class SkillsService {
  private readonly baseUrl = API_CONFIG.endpoints.skills.base;

  constructor(private http: HttpClient) {}

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

    return this.http
      .get<ApiResponse<Page<Skill>>>(this.baseUrl, {
        ...API_CONFIG.httpOptions,
        params,
      })
      .pipe(map((response) => response.data));
  }

  getSkillById(id: number): Observable<Skill> {
    return this.http
      .get<ApiResponse<Skill>>(`${this.baseUrl}/${id}`, API_CONFIG.httpOptions)
      .pipe(map((response) => response.data));
  }

  createSkill(
    skill: Omit<Skill, 'id' | 'userId' | 'categoryName'>
  ): Observable<Skill> {
    return this.http
      .post<ApiResponse<Skill>>(this.baseUrl, skill, API_CONFIG.httpOptions)
      .pipe(map((response) => response.data));
  }

  updateSkill(
    id: number,
    skill: Omit<Skill, 'id' | 'userId' | 'categoryName'>
  ): Observable<Skill> {
    return this.http
      .put<ApiResponse<Skill>>(
        `${this.baseUrl}/${id}`,
        skill,
        API_CONFIG.httpOptions
      )
      .pipe(map((response) => response.data));
  }

  deleteSkill(id: number): Observable<void> {
    return this.http
      .delete<ApiResponse<void>>(
        `${this.baseUrl}/${id}`,
        API_CONFIG.httpOptions
      )
      .pipe(map(() => undefined));
  }
}
