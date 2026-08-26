import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { LoanDecisionResponse } from '../../../models/loan-application/loan-application.models';
import { ApiResponse } from '../../../shared/utils/apiResponse.component';

const API_ORIGIN = 'http://localhost:8080';

/**
 * What the branch manager can DO. Deliberately not called `DecisionOutcome` —
 * that name is already taken by the read-side union in
 * loan-application.models.ts ('APPROVED' | 'REJECTED'), and having two exported
 * types with one name means an auto-import silently picks the wrong one.
 *
 * `PENDING` parks the application without resolving it. Drop it from the union
 * and remove the Pending button if the backend has no such state.
 */
export type DecisionAction = 'APPROVED' | 'REJECTED' | 'PENDING';

export interface BranchManagerDecisionRequest {
  applicationId: string;
  decision: DecisionAction;
  decisionNote?: string;
}

@Injectable({ providedIn: 'root' })
export class BranchManagerService {
  private readonly http = inject(HttpClient);

  /**
   * UNCONFIRMED. Inferred from the marketing review posting to `/api/marketing`
   * — verify the path and the body keys against your controller before wiring
   * this to a real branch manager account.
   */
  private readonly decisionUrl = `${API_ORIGIN}/api/branch-manager`;

  decide(request: BranchManagerDecisionRequest): Observable<LoanDecisionResponse> {
    return this.http
      .post<ApiResponse<LoanDecisionResponse>>(this.decisionUrl, request)
      .pipe(map((res) => res.data));
  }
}
