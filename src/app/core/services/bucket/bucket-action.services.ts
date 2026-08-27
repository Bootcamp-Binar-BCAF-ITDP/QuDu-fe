import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import {
  LoanApplication,
  LoanDisbursementResponse,
  LoanReviewResponse,
  LoanVerificationResponse,
} from '../../../models/loan-application/loan-application.models';

interface ApiResponse<T> {
  message: string;
  data: T;
}

export const CALL_STATUSES = [
  'Can be Contacted',
  'Nada Sambung Tidak Diangkat',
  'Salah Sambung',
] as const;

export type CallStatus = (typeof CALL_STATUSES)[number];

export interface LoanReviewRequest {
  applicationId: string;
  recommendation: 'ACCEPT' | 'REJECT';
  reviewNote?: string;
}

export interface BranchManagerDecisionRequest {
  applicationId: string;
  approve: boolean;
  note?: string;
}

export interface LoanVerificationRequest {
  applicationId: string;
  backOfficeUserId: string;
  callStatus: CallStatus;
  verificationNote?: string;
}

export interface LoanDisbursementRequest {
  applicationId: string;
  backOfficeUserId: string;

  disbursedAmount?: number;
  bankName: string;
  accountNumber: string;
}

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
