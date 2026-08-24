import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import {
  LoanApplication,
  LoanApplicationQuery,
  LoanDocumentResponse,
  LoanReviewRequest,
  LoanReviewResponse,
} from '../../../models/loan-application/loan-application.models';
import { PageResponse } from '../../../models/common/app.models';
import { ApiResponse } from '../../../shared/utils/apiResponse.component';
import { getProtected } from '../../../shared/utils/httpUtils.utils';

/** Single place to change when this moves off localhost (or into environment.ts). */
const API_ORIGIN = 'http://localhost:8080';

@Injectable({ providedIn: 'root' })
export class LoanApplicationService {
  private readonly http = inject(HttpClient);

  private readonly baseUrl = `${API_ORIGIN}/api`;

  private baseParams(query: Omit<LoanApplicationQuery, 'statuses'>): HttpParams {
    let params = new HttpParams()
      .set('page', query.page)
      .set('size', query.size)
      .set('sort', `${query.sortBy},${query.sortDir}`);

    const search = query.search?.trim();
    if (search) {
      params = params.set('search', search);
    }

    return params;
  }

  list(query: LoanApplicationQuery): Observable<PageResponse<LoanApplication>> {
    let params = this.baseParams(query);

    for (const status of query.statuses ?? []) {
      params = params.append('status', status);
    }

    return getProtected<PageResponse<LoanApplication>>(
      this.http,
      `${this.baseUrl}/loan-applications`,
      params,
    ).pipe(map((res) => res.data));
  }

  marketingBucket(
    query: Omit<LoanApplicationQuery, 'statuses'>,
  ): Observable<PageResponse<LoanApplication>> {
    return getProtected<PageResponse<LoanApplication>>(
      this.http,
      `${this.baseUrl}/marketing`,
      this.baseParams(query),
    ).pipe(map((res) => res.data));
  }

  getOne(applicationId: string): Observable<LoanApplication> {
    return getProtected<LoanApplication>(
      this.http,
      `${this.baseUrl}/loan-applications/${encodeURIComponent(applicationId)}`,
      new HttpParams(),
    ).pipe(map((res) => res.data));
  }

  submitReview(request: LoanReviewRequest): Observable<LoanReviewResponse> {
    return this.http
      .post<ApiResponse<LoanReviewResponse>>(`${this.baseUrl}/marketing`, request)
      .pipe(map((res) => res.data));
  }

  documentUrl(document: LoanDocumentResponse | null | undefined): string {
    const raw = document?.fileUrl?.trim();
    if (!raw) return '';

    const normalized = raw.replace(/\\/g, '/');
    if (/^(https?:)?\/\//i.test(normalized) || normalized.startsWith('data:')) {
      return normalized;
    }

    return `${API_ORIGIN}/${normalized.replace(/^\/+/, '')}`;
  }
}
