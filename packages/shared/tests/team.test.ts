import { describe, expect, it } from 'vitest';
import { ProjectMemberAddSchema, ProjectInviteAcceptSchema } from '../src/schemas';

describe('Team input contracts', () => {
  it('requires project scope, accepts only project roles, and normalizes email', () => {
    const data = {
      projectId: '10101010-1010-4101-8101-101010101010',
      email: '  PERSON@example.com  ',
      role: 'viewer',
    };
    expect(ProjectMemberAddSchema.parse(data).email).toBe('person@example.com');
    expect(ProjectMemberAddSchema.safeParse({ ...data, role: 'admin' }).success).toBe(false);
    expect(ProjectMemberAddSchema.safeParse({ ...data, projectId: null }).success).toBe(false);
  });
  it('requires a valid invitation token, name and sufficiently long password', () => {
    const data = {
      token: '10101010-1010-4101-8101-101010101010',
      fullName: ' New colleague ',
      password: 'Password123!',
    };
    expect(ProjectInviteAcceptSchema.parse(data).fullName).toBe('New colleague');
    expect(ProjectInviteAcceptSchema.safeParse({ ...data, token: 'bad' }).success).toBe(false);
    expect(ProjectInviteAcceptSchema.safeParse({ ...data, password: 'short' }).success).toBe(false);
    expect(ProjectInviteAcceptSchema.safeParse({ ...data, fullName: ' ' }).success).toBe(false);
  });
});
