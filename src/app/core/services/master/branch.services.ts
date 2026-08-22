import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiResponse } from '../../../shared/utils/apiResponse.component';
import { Branch } from '../../../models/master/branch.models';
import {
  deleteProtected,
  getProtected,
  postProtected,
  putProtected,
} from '../../../shared/utils/httpUtils.utils';
import { PageParams, PageResponse } from '../../../models/common/app.models';

@Injectable({
  providedIn: 'root',
})
export class BranchService {
  private readonly apiUrl = 'http://localhost:8080/api/branches';

  constructor(private readonly http: HttpClient) {}

  getAllBranches(params: PageParams = {}): Observable<ApiResponse<PageResponse<Branch>>> {
    const {
      page = 0,
      size = 5,
      sortBy = 'branchId',
      sortDir = 'asc',
      search = '',
    } = params;

    return getProtected<PageResponse<Branch>>(this.http, this.apiUrl, {
      page,
      size,
      sortBy,
      sortDir,
      search,
    });
  }

  addBranch(branch: Branch): Observable<any> {
    return postProtected<Branch>(this.http, this.apiUrl, branch);
  }

  updateBranch(branchId: number, branch: Branch): Observable<any> {
    return putProtected<Branch>(this.http, `${this.apiUrl}/update/${branchId}`, branch);
  }

  deleteBranch(branchId: number): Observable<any> {
    return deleteProtected<any>(this.http, `${this.apiUrl}/delete/${branchId}`);
  }
}
