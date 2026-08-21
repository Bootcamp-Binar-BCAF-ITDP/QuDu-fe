import { HttpContextToken } from '@angular/common/http';

export const REQUIRES_AUTH = new HttpContextToken<boolean>(() => false);
