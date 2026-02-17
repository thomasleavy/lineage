export const ROLES = [
  'CREATIVE_DIRECTOR',
  'LEAD_DESIGNER',
  'ATELIER',
  'ASSISTANT',
  'ARCHIVE_READONLY',
  'LEGAL_AUDIT',
] as const;

export type RoleName = (typeof ROLES)[number];

export function hasRole(userRoles: { role: { name: string } }[], roleName: RoleName): boolean {
  return userRoles.some((ur) => ur.role.name === roleName);
}

export function hasAnyRole(userRoles: { role: { name: string } }[], names: RoleName[]): boolean {
  return names.some((name) => hasRole(userRoles, name));
}

/** Only CREATIVE_DIRECTOR can hard-delete */
export function canHardDelete(userRoles: { role: { name: string } }[]): boolean {
  return hasRole(userRoles, 'CREATIVE_DIRECTOR');
}

/** Who can export press PDF (redacted). LEAD_DESIGNER + CREATIVE_DIRECTOR */
export function canExportPressPdf(userRoles: { role: { name: string } }[]): boolean {
  return hasAnyRole(userRoles, ['CREATIVE_DIRECTOR', 'LEAD_DESIGNER']);
}

/** Who can export run-of-show (full) PDF */
export function canExportRunOfShowPdf(userRoles: { role: { name: string } }[]): boolean {
  return hasAnyRole(userRoles, ['CREATIVE_DIRECTOR', 'LEAD_DESIGNER']);
}

/** ASSISTANT cannot export any PDF */
export function canExportAnyPdf(userRoles: { role: { name: string } }[]): boolean {
  return canExportPressPdf(userRoles) || canExportRunOfShowPdf(userRoles);
}

/** Who can create/edit/approve garments. ASSISTANT can only create drafts / limited edit */
export function canEditGarments(userRoles: { role: { name: string } }[]): boolean {
  return hasAnyRole(userRoles, ['CREATIVE_DIRECTOR', 'LEAD_DESIGNER', 'ATELIER', 'ASSISTANT']);
}

/** Who can upload assets and add scan notes (ASSISTANT + above; needed for creating versions with images) */
export function canUploadAssets(userRoles: { role: { name: string } }[]): boolean {
  return hasAnyRole(userRoles, ['CREATIVE_DIRECTOR', 'LEAD_DESIGNER', 'ATELIER', 'ASSISTANT']);
}

/** Who can create lookbooks. ASSISTANT cannot (but can create garment versions and quick notes). */
export function canCreateLookbooks(userRoles: { role: { name: string } }[]): boolean {
  return hasAnyRole(userRoles, ['CREATIVE_DIRECTOR', 'LEAD_DESIGNER', 'ATELIER']);
}

/** Who can delete lookbooks. Director and lead designer only. */
export function canDeleteLookbooks(userRoles: { role: { name: string } }[]): boolean {
  return hasAnyRole(userRoles, ['CREATIVE_DIRECTOR', 'LEAD_DESIGNER']);
}

/** Who can archive/restore garments. Lead designer and director only. */
export function canArchiveGarment(userRoles: { role: { name: string } }[]): boolean {
  return hasAnyRole(userRoles, ['CREATIVE_DIRECTOR', 'LEAD_DESIGNER']);
}

/** Read-only roles */
export function isReadOnly(userRoles: { role: { name: string } }[]): boolean {
  return hasAnyRole(userRoles, ['ARCHIVE_READONLY', 'LEGAL_AUDIT']);
}

/** LEGAL_AUDIT: read + audit log access */
export function canAccessAuditLog(userRoles: { role: { name: string } }[]): boolean {
  return hasAnyRole(userRoles, ['CREATIVE_DIRECTOR', 'LEGAL_AUDIT']);
}

/** At least read access to garments */
export function canViewGarments(userRoles: { role: { name: string } }[]): boolean {
  return userRoles.length > 0;
}
