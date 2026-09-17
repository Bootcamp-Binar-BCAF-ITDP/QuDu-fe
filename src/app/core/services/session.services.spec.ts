import { TestBed } from '@angular/core/testing';

import { SessionService, SessionUser } from './session.services';

const user = (over: Partial<SessionUser> = {}): SessionUser => ({
  userId: 'U-1',
  role: 'MARKETING',
  fullName: 'Marketing One',
  branchId: 3,
  ...over,
});

describe('SessionService', () => {
  let service: SessionService;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    service = TestBed.inject(SessionService);
  });

  it('starts with nobody signed in', () => {
    expect(service.user()).toBeNull();
    expect(service.role()).toBeNull();
    expect(service.userId()).toBeNull();
  });

  it('holds the user it was given', () => {
    service.setUser(user());
    expect(service.user()).toMatchObject({ userId: 'U-1', role: 'MARKETING' });
  });

  it('derives the role from the user', () => {
    service.setUser(user({ role: 'BACK_OFFICE' }));
    expect(service.role()).toBe('BACK_OFFICE');
  });

  it('derives the id from the user', () => {
    service.setUser(user({ userId: 'U-9' }));
    expect(service.userId()).toBe('U-9');
  });

  it('clears both derived values when the user is cleared', () => {
    service.setUser(user());
    service.setUser(null);

    expect(service.role()).toBeNull();
    expect(service.userId()).toBeNull();
  });

  it('replaces the user rather than merging', () => {
    service.setUser(user({ fullName: 'First', branchId: 1 }));
    service.setUser({ userId: 'U-2', role: 'BRANCH_MANAGER' });

    expect(service.user()).toEqual({ userId: 'U-2', role: 'BRANCH_MANAGER' });
  });

  it('exposes the user as read only, so only setUser can change it', () => {
    expect((service.user as unknown as { set?: unknown }).set).toBeUndefined();
  });

  it('declares a role union that does not match the backend, which is why nothing injects this', () => {
    const declared: SessionUser['role'][] = [
      'MARKETING',
      'BRANCH_MANAGER',
      'BACK_OFFICE',
      'ADMIN',
    ];

    expect(declared).toContain('ADMIN');
    expect(declared).not.toContain('SUPERADMIN' as never);
    expect(declared).not.toContain('CUSTOMER' as never);
  });
});
