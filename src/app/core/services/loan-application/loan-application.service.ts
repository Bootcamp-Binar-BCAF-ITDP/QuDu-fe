import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import {
  LoanApplication,
  LoanApplicationQuery,
  LoanReviewRequest,
  LoanReviewResponse,
} from '../../../models/loan-application/loan-application.models';
import { PageResponse } from '../../../models/common/app.models';
import { ApiResponse } from '../../../shared/utils/apiResponse.component';

@Injectable({ providedIn: 'root' })
export class LoanApplicationService {
  private readonly http = inject(HttpClient);

  private readonly baseUrl = 'http://localhost:8080/api';
  
  private baseParams(query: Omit<LoanApplicationQuery, 'statuses'>): HttpParams {
    return new HttpParams()
      .set('page', query.page)
      .set('size', query.size)
      .set('sort', `${query.sortBy},${query.sortDir}`);
  }

  /** GET /api/loan-applications?page&size&sort[&status=…&status=…] */
  list(query: LoanApplicationQuery): Observable<PageResponse<LoanApplication>> {
    let params = this.baseParams(query);

    // An empty array means "no filter" — append nothing.
    for (const status of query.statuses ?? []) {
      params = params.append('status', status);
    }

    return this.http
      .get<ApiResponse<PageResponse<LoanApplication>>>(`${this.baseUrl}/loan-applications`, {
        params,
      })
      .pipe(map((res) => res.data));
  }

  /** GET /api/marketing — the CHECKING bucket, unscoped by branch. */
  marketingBucket(
    query: Omit<LoanApplicationQuery, 'statuses'>,
  ): Observable<PageResponse<LoanApplication>> {
    return this.http
      .get<ApiResponse<PageResponse<LoanApplication>>>(`${this.baseUrl}/marketing`, {
        params: this.baseParams(query),
      })
      .pipe(map((res) => res.data));
  }

  /** GET /api/loan-applications/{applicationId} */
  getOne(applicationId: string): Observable<LoanApplication> {
    return this.http
      .get<ApiResponse<LoanApplication>>(`${this.baseUrl}/loan-applications/${applicationId}`)
      .pipe(map((res) => res.data));
  }

  /** POST /api/marketing — accept or reject an application in CHECKING. */
  submitReview(request: LoanReviewRequest): Observable<LoanReviewResponse> {
    return this.http
      .post<ApiResponse<LoanReviewResponse>>(`${this.baseUrl}/marketing`, request)
      .pipe(map((res) => res.data));
  }
}
