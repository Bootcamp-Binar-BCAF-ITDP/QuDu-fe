import { Injectable, computed, signal } from '@angular/core';

/** Matches RoleName on the server. */
export type RoleName = 'MARKETING' | 'BRANCH_MANAGER' | 'BACK_OFFICE' | 'ADMIN';

export interface SessionUser {
  userId: string;
  role: RoleName;
  fullName?: string;
  branchId?: number;
}

@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly current = signal<SessionUser | null>(null);

  readonly user = this.current.asReadonly();

  readonly role = computed<RoleName | null>(() => this.current()?.role ?? null);

  readonly userId = computed<string | null>(() => this.current()?.userId ?? null);

  setUser(user: SessionUser | null): void {
    this.current.set(user);
  }
}
