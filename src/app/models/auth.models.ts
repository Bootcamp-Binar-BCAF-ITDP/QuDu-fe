export interface LoginRequest {
  usernameOrEmail: string;
  password: string;
  accountType: string;
}

export interface LoginMenu {
  menuId: number;
  menuName: string;
}

export interface LoginResponse {
  token: string;
  refreshToken: string;
  expiresIn: number;
  userId: string;
  username: string;
  role: string;
  email: string;
  fullName: string;
  menus: LoginMenu[];
}


export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  fullName: string;
  accountType: string;
  phoneNumber: string;
  roleId: number;
  branchId: number;
}

export interface RegisterResponse {
  message: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
  confirmPassword: string;
}
