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
import { getProtected, postProtected, putProtected } from '../../../shared/utils/httpUtils.utils';

/** Single place to change when this moves off localhost (or into environment.ts). */
const API_ORIGIN = 'http://localhost:8080';

/**
 * PUT /api/bm/decision. BranchManagerDecisionRequest is read as getApprove()
 * and getNote(), and the manager comes from @AuthenticationPrincipal — so do
 * not send a user id.
 */
export interface BranchManagerDecisionRequest {
  applicationId: string;
  approve: boolean;
  note?: string;
}

/**
 * The two back office requests carry backOfficeUserId in the body, because
 * LoanVerificationService and LoanDisbursementService read it off the request
 * rather than the principal. Worth aligning with the other two eventually — as
 * written, a back office user can post another user's id.
 */
export interface LoanVerificationRequest {
  applicationId: string;
  backOfficeUserId: string;
  callStatus: string;
  verificationNote?: string;
}

export interface LoanDisbursementRequest {
  applicationId: string;
  backOfficeUserId: string;
  /** Omit to let the server fall back to the requested amount. */
  disbursedAmount?: number;
  bankName: string;
  accountNumber: string;
}

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

  /** The one bucket endpoint — the server fans out by role in getMyBucket. */
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

  // ---- workflow transitions ----

  /** Step 2. CHECKING -> PENDING_BRANCH_MANAGER or REJECTED_BY_MARKETING. */
  submitReview(request: LoanReviewRequest): Observable<any> {
    debugger
    return postProtected<LoanReviewRequest>(this.http, `${this.baseUrl}/marketing`, request)
  }

  /** Step 3. PENDING_BRANCH_MANAGER -> PENDING_BACK_OFFICE or REJECTED_BY_BRANCH_MANAGER. */
  decide(request: BranchManagerDecisionRequest): Observable<any> {
    return putProtected<BranchManagerDecisionRequest>(this.http, `${this.baseUrl}/bm/decision`, request).pipe(map((res) => res.data))
    // return this.http
    //   .put<ApiResponse<LoanApplication>>(`${this.baseUrl}/bm/decision`, request)
    //   .pipe(map((res) => res.data));
  }

  /**
   * Step 4. Stays in PENDING_BACK_OFFICE unless the call status is
   * 'Can be Contacted', which moves it to VERIFIED.
   *
   * TODO: you have not uploaded a verification controller, so this path is a
   * guess. Change the one string below to match your @RequestMapping.
   */
  logCall(request: LoanVerificationRequest): Observable<unknown> {
    return this.http.post<ApiResponse<unknown>>(`${this.baseUrl}/loan-verifications`, request);
  }

  /** Step 5. VERIFIED -> DISBURSED. Same TODO about the path as logCall. */
  disburse(request: LoanDisbursementRequest): Observable<unknown> {
    return this.http.post<ApiResponse<unknown>>(`${this.baseUrl}/loan-disbursements`, request);
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
