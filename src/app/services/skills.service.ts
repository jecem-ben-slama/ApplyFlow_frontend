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

  /**
   * GET /api/skills
   * Retrieves a paginated slice of the master skills directory wrapped inside an ApiResponse envelope.
   */
  getAllSkills(
    page: number = 0,
    size: number = 10,
    sortBy: string = 'id',
    direction: 'asc' | 'desc' = 'asc'
  ): Observable<Page<Skill>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString())
      .set('sortBy', sortBy)
      .set('direction', direction);

    return this.http
      .get<ApiResponse<Page<Skill>>>(this.baseUrl, {
        ...API_CONFIG.httpOptions,
        params,
      })
      .pipe(map((response) => response.data));
  }

  /**
   * GET /api/skills/{id}
   * Fetches a single master skill record by its unique identifier.
   */
  getSkillById(id: number): Observable<Skill> {
    return this.http
      .get<ApiResponse<Skill>>(`${this.baseUrl}/${id}`, API_CONFIG.httpOptions)
      .pipe(map((response) => response.data));
  }

  /**
   * POST /api/skills
   * Registers a brand new master skill key payload on the system.
   */
  createSkill(skill: Omit<Skill, 'id'>): Observable<Skill> {
    return this.http
      .post<ApiResponse<Skill>>(this.baseUrl, skill, API_CONFIG.httpOptions)
      .pipe(map((response) => response.data));
  }

  /**
   * PUT /api/skills/{id}
   * Updates an existing skill profile by parsing matching resource IDs.
   */
  updateSkill(id: number, skill: Omit<Skill, 'id'>): Observable<Skill> {
    return this.http
      .put<ApiResponse<Skill>>(
        `${this.baseUrl}/${id}`,
        skill,
        API_CONFIG.httpOptions
      )
      .pipe(map((response) => response.data));
  }

  /**
   * DELETE /api/skills/{id}
   * Completely destroys a master skill reference matching target path mappings.
   */
  deleteSkill(id: number): Observable<void> {
    return this.http
      .delete<ApiResponse<void>>(
        `${this.baseUrl}/${id}`,
        API_CONFIG.httpOptions
      )
      .pipe(map(() => undefined));
  }
}
