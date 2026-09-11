import { environment } from '../../../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResponse } from '../../../shared/utils/apiResponse.component';
import { Role, RoleRequest } from '../../../models/master/role.models';
import { PageParams, PageResponse } from '../../../models/common/app.models';
import {
  deleteProtected,
  getProtected,
  postProtected,
  putProtected,
} from '../../../shared/utils/httpUtils.utils';

@Injectable({
  providedIn: 'root',
})
export class RolesService {
  private readonly apiUrl = `${environment.apiOrigin}/api/roles`;

  constructor(private readonly http: HttpClient) {}

  getAllRoles(params: PageParams = {}): Observable<ApiResponse<PageResponse<Role>>> {
    const { page = 0, size = 5, sortBy = 'roleId', sortDir = 'asc', search = '' } = params;

    return getProtected<PageResponse<Role>>(this.http, this.apiUrl, {
      page,
      size,
      sortBy,
      sortDir,
      search,
    });
  }
  getRoleOptions(): Observable<ApiResponse<Role[]>> {
    return getProtected<Role[]>(this.http, `${this.apiUrl}/options`);
  }

  addRoles(request: RoleRequest): Observable<any> {
    return postProtected<RoleRequest>(this.http, this.apiUrl, request);
  }

  updateRole(roleId: number, request: RoleRequest): Observable<any> {
    return putProtected<RoleRequest>(this.http, `${this.apiUrl}/update/${roleId}`, request);
  }

  deleteRole(roleId: number): Observable<any> {
    return deleteProtected<any>(this.http, `${this.apiUrl}/delete/${roleId}`);
  }
}
