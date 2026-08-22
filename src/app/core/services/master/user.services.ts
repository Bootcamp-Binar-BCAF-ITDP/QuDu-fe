import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { User, UserRequest } from '../../../models/master/user.models';
import { deleteProtected, getProtected, putProtected } from '../../../shared/utils/httpUtils.utils';
import { PageParams, PageResponse } from '../../../models/common/app.models';
import { ApiResponse } from '../../../shared/utils/apiResponse.component';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private readonly apiUrl = 'http://localhost:8080/api/users';
  private readonly registerUrl = 'http://localhost:8080/api/auth/register';

  constructor(private readonly http: HttpClient) {}

  getAllUsers(params: PageParams = {}): Observable<ApiResponse<PageResponse<User>>> {
    const { page = 0, size = 5, sortBy = 'username', sortDir = 'asc', search = '' } = params;
    return getProtected<PageResponse<User>>(this.http, this.apiUrl, {
      page,
      size,
      sortBy,
      sortDir,
      search,
    });
  }

  createUser(request: UserRequest): Observable<any> {
    return this.http.post<any>(this.registerUrl, request);
  }

  updateUser(userId: string, request: UserRequest): Observable<any> {
    return putProtected<UserRequest>(this.http, `${this.apiUrl}/${userId}`, request);
  }

  deleteUser(userId: string): Observable<any> {
    return deleteProtected<any>(this.http, `${this.apiUrl}/${userId}`);
  }
}
