import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { BranchManagerDecisionRequest, LoanApplication } from '../../../models/loan-application/loan-application.models';
import { ApiResponse } from '../../../shared/utils/apiResponse.component';

// export type DecisionAction = 'APPROVED' | 'REJECTED';

// export interface BranchManagerDecisionRequest {
//   applicationId: string;
//   approve: boolean;
//   note?: string;
// }

// interface ApiResponse<T> {
//   message: string;
//   data: T;
// }

@Injectable({ providedIn: 'root' })
export class BranchManagerService {
  private readonly http = inject(HttpClient);

  private readonly base = '/api/bm';

  decide(request: BranchManagerDecisionRequest): Observable<LoanApplication> {
    return this.http
      .put<ApiResponse<LoanApplication>>(`${this.base}/decision`, request)
      .pipe(map((response) => response.data));
  }
}
