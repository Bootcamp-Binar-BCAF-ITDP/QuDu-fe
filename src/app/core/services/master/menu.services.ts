import { Injectable } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { Observable } from 'rxjs';

import { ApiResponse } from '../../../shared/utils/apiResponse.component';
import { Menu, MenuRequest } from '../../../models/master/menu.models';
import { REQUIRES_AUTH } from '../../context/auth-context';
import { deleteProtected, getProtected, postProtected, putProtected } from '../../../shared/utils/httpUtils.utils';

@Injectable({
  providedIn: 'root',
})
export class MenuService {
  private readonly apiUrl = 'http://localhost:8080/api/menus';

  constructor(private readonly http: HttpClient) {}

  getAllMenus(): Observable<ApiResponse<Menu[]>> {
    return getProtected<Menu[]>(this.http, this.apiUrl);
  }

  addMenu(request: MenuRequest): Observable<any> {
    return postProtected<MenuRequest>(this.http, this.apiUrl, request);
  }

  updateMenu(menuId: number, request: MenuRequest): Observable<any> {
    return putProtected<MenuRequest>(this.http, `${this.apiUrl}/${menuId}`, request);
  }

  deleteMenu(menuId: number): Observable<any> {
    return deleteProtected<any>(this.http, `${this.apiUrl}/${menuId}`);
  }
}
