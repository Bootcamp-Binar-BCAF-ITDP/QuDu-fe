import { environment } from '../../../../environments/environment';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import {
  BranchManagerDecisionRequest,
  LoanApplication,
  LoanApplicationQuery,
  LoanDisbursementRequest,
  LoanDisbursementResponse,
  LoanDocumentResponse,
  LoanReviewRequest,
  LoanReviewResponse,
  LoanVerificationRequest,
} from '../../../models/loan-application/loan-application.models';
import { PageResponse } from '../../../models/common/app.models';
import { ApiResponse } from '../../../shared/utils/apiResponse.component';
import { getProtected, postProtected, putProtected } from '../../../shared/utils/httpUtils.utils';

const API_ORIGIN = environment.apiOrigin;

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

  myBucket(
    query: Omit<LoanApplicationQuery, 'statuses'>,
  ): Observable<PageResponse<LoanApplication>> {
    return getProtected<PageResponse<LoanApplication>>(
      this.http,
      `${this.baseUrl}/loan-applications/bucket`,
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

  submitReview(request: LoanReviewRequest): Observable<any> {
    return postProtected<LoanReviewRequest>(this.http, `${this.baseUrl}/marketing`, request)
  }

  decide(request: BranchManagerDecisionRequest): Observable<any> {
    return putProtected<BranchManagerDecisionRequest>(this.http, `${this.baseUrl}/bm/decision`, request).pipe(map((res) => res.data))
  }

  logCall(request: LoanVerificationRequest): Observable<unknown> {
    return postProtected<LoanVerificationRequest>(this.http, `${this.baseUrl}/loan-verifications`, request);
  }

  disburse(request: LoanDisbursementRequest): Observable<any> {
    return putProtected<LoanDisbursementRequest>(this.http, `${this.baseUrl}/loan-disbursements`, request).pipe(map((res) => res.data));
  }

  // documentUrl() lived here and pointed at ${API_ORIGIN}/uploads/... built from
  // the stored filesystem path. Nothing serves /uploads/** and Spring Security
  // answers 401 there, so it never resolved. Documents now come from
  // DocumentPreviewService, which fetches the real endpoint as a Blob.
}
