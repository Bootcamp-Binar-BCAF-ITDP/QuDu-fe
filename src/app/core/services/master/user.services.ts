import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { User, UserRequest } from '../../../models/master/user.models';
import { deleteProtected, getProtected, putProtected } from '../../../shared/utils/httpUtils.utils';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private readonly apiUrl = 'http://localhost:8080/api/users';
  private readonly registerUrl = 'http://localhost:8080/api/auth/register';

  constructor(private readonly http: HttpClient) {}

  getAllUsers(): Observable<any> {
    return getProtected<User[]>(this.http, this.apiUrl);
  }

  createUser(request: UserRequest): Observable<any> {
    return this.http.post<any>(this.registerUrl, request);
  }

  updateUser(userId: number, request: UserRequest): Observable<any> {
    return putProtected<UserRequest>(this.http, `${this.apiUrl}/${userId}`, request);
  }

  deleteUser(userId: number): Observable<any> {
    return deleteProtected<any>(this.http, `${this.apiUrl}/${userId}`);
  }
}
