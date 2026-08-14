import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiConfig } from 'src/app/config';
import { Page, ApiResponse } from 'src/app/models';
import { ApplicationPresetDto, ApplicationPresetCreateDto } from 'src/app/models/application_preset.model';

@Injectable({
  providedIn: 'root',
})
export class ApplicationPresetService {
  constructor(private http: HttpClient, private api: ApiConfig) {}

  private get baseUrl(): string {
    return this.api.endpoints.applicationPresets.base;
  }

  getAllPresets(
    page: number = 0,
    size: number = 20,
    sortBy: string = 'name',
    direction: 'asc' | 'desc' = 'asc',
    keyword?: string,
    language?: string
  ): Observable<Page<ApplicationPresetDto>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString())
      .set('sortBy', sortBy)
      .set('direction', direction);

    if (keyword) params = params.set('keyword', keyword);
    if (language) params = params.set('language', language);

    return this.http
      .get<ApiResponse<Page<ApplicationPresetDto>>>(this.baseUrl, {
        params,
        withCredentials: this.api.httpOptions.withCredentials,
      })
      .pipe(map((response) => response.data));
  }

  createPreset(
    preset: ApplicationPresetCreateDto
  ): Observable<ApplicationPresetDto> {
    return this.http
      .post<ApiResponse<ApplicationPresetDto>>(this.baseUrl, preset, {
        withCredentials: this.api.httpOptions.withCredentials,
      })
      .pipe(map((response) => response.data));
  }

  updatePreset(
    id: number,
    preset: Partial<ApplicationPresetCreateDto>
  ): Observable<ApplicationPresetDto> {
    return this.http
      .patch<ApiResponse<ApplicationPresetDto>>(
        `${this.baseUrl}/${id}`,
        preset,
        { withCredentials: this.api.httpOptions.withCredentials }
      )
      .pipe(map((response) => response.data));
  }

  deletePreset(id: number): Observable<void> {
    return this.http
      .delete<ApiResponse<void>>(`${this.baseUrl}/${id}`, {
        withCredentials: this.api.httpOptions.withCredentials,
      })
      .pipe(map(() => undefined));
  }
}
