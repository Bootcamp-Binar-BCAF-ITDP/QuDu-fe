import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { ApiResponse } from '../../../shared/utils/apiResponse.component';
import { Menu, MenuRequest } from '../../../models/master/menu.models';
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
export class MenuService {
  private readonly apiUrl = 'http://localhost:8080/api/menus';

  constructor(private readonly http: HttpClient) {}

  getAllMenus(params: PageParams = {}): Observable<ApiResponse<PageResponse<Menu>>> {
    const { page = 0, size = 5, sortBy = 'menuId', sortDir = 'asc', search = '' } = params;

    return getProtected<PageResponse<Menu>>(this.http, this.apiUrl, {
      page,
      size,
      sortBy,
      sortDir,
      search,
    });
  }
  getMenuOptions(): Observable<ApiResponse<Menu[]>> {
    return getProtected<Menu[]>(this.http, `${this.apiUrl}/options`);
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
