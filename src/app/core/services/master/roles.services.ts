import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResponse } from '../../../shared/utils/apiResponse.component';
import { Role, RoleRequest } from '../../../models/master/role.models';
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
  private readonly apiUrl = 'http://localhost:8080/api/roles';

  constructor(private readonly http: HttpClient) {}

  getAllRoles(): Observable<ApiResponse<Role[]>> {
    return getProtected<Role[]>(this.http, this.apiUrl);
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
