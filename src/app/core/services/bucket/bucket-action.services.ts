import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import {
  BranchManagerDecisionRequest,
  LoanApplication,
  LoanDisbursementRequest,
  LoanDisbursementResponse,
  LoanReviewRequest,
  LoanReviewResponse,
  LoanVerificationRequest,
  LoanVerificationResponse,
} from '../../../models/loan-application/loan-application.models';
import { ApiResponse } from '../../../shared/utils/apiResponse.component';

@Injectable({ providedIn: 'root' })
export class BucketActionsService {
  private readonly http = inject(HttpClient);

  private readonly api = '/api';

  submitReview(body: LoanReviewRequest): Observable<LoanReviewResponse> {
    return this.http
      .post<ApiResponse<LoanReviewResponse>>(`${this.api}/marketing`, body)
      .pipe(map((response) => response.data));
  }

  decide(body: BranchManagerDecisionRequest): Observable<LoanApplication> {
    return this.http
      .put<ApiResponse<LoanApplication>>(`${this.api}/bm/decision`, body)
      .pipe(map((response) => response.data));
  }
  logCall(body: LoanVerificationRequest): Observable<LoanVerificationResponse> {
    return this.http
      .post<ApiResponse<LoanVerificationResponse>>(`${this.api}/loan-verifications`, body)
      .pipe(map((response) => response.data));
  }

  disburse(body: LoanDisbursementRequest): Observable<LoanDisbursementResponse> {
    return this.http
      .post<ApiResponse<LoanDisbursementResponse>>(`${this.api}/loan-disbursements`, body)
      .pipe(map((response) => response.data));
  }
}
