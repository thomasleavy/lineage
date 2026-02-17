import { describe, it, expect } from 'vitest';
import {
  canHardDelete,
  canExportPressPdf,
  canEditGarments,
  canUploadAssets,
  isReadOnly,
  canAccessAuditLog,
} from '~/server/rbac';

const userRoles = (names: string[]) =>
  names.map((name) => ({ role: { name } }));

describe('RBAC', () => {
  it('CREATIVE_DIRECTOR can hard-delete', () => {
    expect(canHardDelete(userRoles(['CREATIVE_DIRECTOR']))).toBe(true);
    expect(canHardDelete(userRoles(['LEAD_DESIGNER']))).toBe(false);
  });

  it('LEAD_DESIGNER and CREATIVE_DIRECTOR can export press PDF', () => {
    expect(canExportPressPdf(userRoles(['LEAD_DESIGNER']))).toBe(true);
    expect(canExportPressPdf(userRoles(['CREATIVE_DIRECTOR']))).toBe(true);
    expect(canExportPressPdf(userRoles(['ATELIER']))).toBe(false);
  });

  it('canEditGarments includes ATELIER and ASSISTANT', () => {
    expect(canEditGarments(userRoles(['ATELIER']))).toBe(true);
    expect(canEditGarments(userRoles(['ASSISTANT']))).toBe(true);
    expect(canEditGarments(userRoles(['ARCHIVE_READONLY']))).toBe(false);
  });

  it('canUploadAssets includes ATELIER', () => {
    expect(canUploadAssets(userRoles(['ATELIER']))).toBe(true);
    expect(canUploadAssets(userRoles(['ASSISTANT']))).toBe(false);
  });

  it('isReadOnly for ARCHIVE_READONLY and LEGAL_AUDIT', () => {
    expect(isReadOnly(userRoles(['ARCHIVE_READONLY']))).toBe(true);
    expect(isReadOnly(userRoles(['LEGAL_AUDIT']))).toBe(true);
    expect(isReadOnly(userRoles(['LEAD_DESIGNER']))).toBe(false);
  });

  it('canAccessAuditLog for CREATIVE_DIRECTOR and LEGAL_AUDIT', () => {
    expect(canAccessAuditLog(userRoles(['LEGAL_AUDIT']))).toBe(true);
    expect(canAccessAuditLog(userRoles(['CREATIVE_DIRECTOR']))).toBe(true);
    expect(canAccessAuditLog(userRoles(['LEAD_DESIGNER']))).toBe(false);
  });
});
