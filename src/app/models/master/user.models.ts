export interface User {
  userId?: number;
  username: string;
  email: string;
  password?: string;
  fullName: string;
  phoneNumber: string;
  accountType?: string;
  roleId?: number;
  roleName?: string;
  branchId?: number;
  branchName?: string;
  isActive?: boolean;
}

export interface UserRequest {
  username: string;
  email: string;
  password?: string;
  fullName: string;
  accountType: string;
  phoneNumber: string;
  roleId: number;
  branchId: number;
}
