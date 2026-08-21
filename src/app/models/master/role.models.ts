import { Menu } from "./menu.models";

export interface Role {
  roleId: number;
  roleName: string;
  menus: Menu[];
  description: string;
}

export interface RoleRequest {
  roleName: string;
  description: string;
  menuIds: number[];
}
