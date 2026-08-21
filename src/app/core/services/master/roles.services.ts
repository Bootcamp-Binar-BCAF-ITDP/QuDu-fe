import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResponse } from '../../../shared/utils/apiResponse.component';
import { Role, RoleRequest } from '../../../models/master/role.models';
import { getProtected } from '../../../shared/utils/httpUtils.utils';

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
    return this.http.post<any>(this.apiUrl, request);
  }

  updateRole(roleId: number, request: RoleRequest): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/update/${roleId}`, request);
  }

  deleteRole(roleId: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/delete/${roleId}`);
  }
}
